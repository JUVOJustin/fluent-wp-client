import { tool } from "ai";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { WordPressPostLike } from "../schemas.js";
import type { QueryParams } from "../types/resources.js";
import {
  createContentCollectionInputSchema,
  createContentDeleteInputSchema,
  createContentGetInputSchema,
  createContentSaveInputSchema,
} from "./catalog-schemas.js";
import {
  asToolArgs,
  type ContentQueryLike,
  normalizeFieldSelection,
  prepareCollectionArgs,
  resolveContentQuery,
  withToolErrorHandling,
} from "./factories.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import type {
  ContentCollectionToolOptions,
  ContentDeleteToolOptions,
  ContentGetToolOptions,
  ContentSaveToolOptions,
  ToolFactoryOptions,
} from "./types.js";

function resolveContentType(
  merged: Record<string, unknown>,
  options?: { contentType?: string },
): string {
  const contentType =
    options?.contentType ??
    (typeof merged.contentType === "string" ? merged.contentType : undefined);
  if (!contentType) {
    throw createInvalidRequestError(
      "contentType must be provided either in the tool config or the tool input.",
    );
  }

  return contentType;
}

function stripContentType(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const { contentType: _contentType, ...rest } = args;
  return rest;
}

/**
 * AI SDK tool that lists items from a custom content resource.
 *
 * Provide `fetch` to replace the default client call — useful for routing
 * through a cache, live loader, or any custom fetch layer. The callback
 * receives the fully resolved `contentType` and normalised `filter` after
 * `fixedArgs` and field-selection normalisation have already been applied.
 */
export const getContentCollectionTool = (
  client: WordPressClient,
  options?: ContentCollectionToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description: options?.description ?? "Search and filter WordPress content",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const contentType = resolveContentType(merged, options);
      const filter = prepareCollectionArgs(
        stripContentType(merged),
        options as ToolFactoryOptions<Record<string, unknown>>,
      );
      if (options?.fetch) {
        return options.fetch({ contentType, filter: filter as QueryParams });
      }

      return client.content(contentType).list(filter as QueryParams);
    }),
    inputSchema: (options?.inputSchema ??
      createContentCollectionInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that fetches a single custom content item by ID or slug.
 *
 * Provide `fetch` to replace the default client call. The callback receives
 * the resolved `contentType`, normalised `id` or `slug`, and the
 * `includeContent` / `includeBlocks` flags after `fixedArgs` have been applied.
 */
export const getContentTool = (
  client: WordPressClient,
  options?: ContentGetToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description:
      options?.description ??
      "Get a single WordPress content item by ID or slug",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = normalizeFieldSelection(
        mergeToolArgs(
          asToolArgs(args as Record<string, unknown>),
          options?.fixedArgs,
        ),
      );
      const contentType = resolveContentType(merged, options);
      const id = typeof merged.id === "number" ? merged.id : undefined;
      const slug = typeof merged.slug === "string" ? merged.slug : undefined;
      const contentOpts = merged as {
        includeContent?: boolean;
        includeBlocks?: boolean;
      };
      const itemOptions = {
        fields: merged.fields as string[] | undefined,
      };

      if (options?.fetch) {
        return options.fetch({
          contentType,
          id,
          includeBlocks: contentOpts.includeBlocks,
          includeContent: contentOpts.includeContent,
          slug,
        });
      }

      if (id !== undefined) {
        return resolveContentQuery(
          client
            .content(contentType)
            .item(id, itemOptions) as unknown as ContentQueryLike<
            WordPressPostLike | undefined
          >,
          contentOpts,
        );
      }

      if (slug !== undefined) {
        return resolveContentQuery(
          client
            .content(contentType)
            .item(slug, itemOptions) as unknown as ContentQueryLike<
            WordPressPostLike | undefined
          >,
          contentOpts,
        );
      }

      throw createInvalidRequestError("Either id or slug must be provided.");
    }),
    inputSchema: (options?.inputSchema ??
      createContentGetInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that creates or updates a custom content item.
 *
 * Presence of `id` in the model input switches to an update call; omitting
 * `id` routes to a create call. One tool covers both WordPress write modes
 * so the model only sees a single mutation surface.
 *
 * Provide `fetch` to replace the default client call. The callback receives
 * the resolved `contentType`, optional `id`, and merged `input` after
 * `fixedInput` has been applied — useful for routing through a proxy, audit
 * log, or queue.
 */
export const saveContentTool = (
  client: WordPressClient,
  options?: ContentSaveToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description:
      options?.description ?? "Create or update a WordPress content item",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const contentType = resolveContentType(merged, options);
      const withInput = mergeMutationInput(
        merged,
        options?.defaultInput,
        options?.fixedInput,
      );
      const id =
        typeof withInput.id === "number" ? (withInput.id as number) : undefined;
      const input = withInput.input as Record<string, unknown>;

      if (options?.fetch) {
        return options.fetch({ contentType, id, input });
      }

      const resource = client.content(contentType);
      return id === undefined
        ? resource.create(input)
        : resource.update(id, input);
    }),
    inputSchema: (options?.inputSchema ??
      createContentSaveInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that deletes a custom content item.
 *
 * Provide `fetch` to replace the default client call. The callback receives
 * the resolved `contentType`, `id`, and optional `force` flag.
 */
export const deleteContentTool = (
  client: WordPressClient,
  options?: ContentDeleteToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description: options?.description ?? "Delete a WordPress content item",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const contentType = resolveContentType(merged, options);

      if (options?.fetch) {
        return options.fetch({
          contentType,
          force: merged.force as boolean | undefined,
          id: merged.id as number,
        });
      }

      return client.content(contentType).delete(merged.id as number, {
        force: merged.force as boolean | undefined,
      });
    }),
    inputSchema: (options?.inputSchema ??
      createContentDeleteInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};
