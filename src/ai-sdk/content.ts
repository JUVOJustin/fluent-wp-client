import { tool } from "ai";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { WordPressPostLike } from "../schemas.js";
import type { QueryParams } from "../types/resources.js";
import {
  createContentCollectionInputSchema,
  createContentCreateInputSchema,
  createContentDeleteInputSchema,
  createContentGetInputSchema,
  createContentUpdateInputSchema,
} from "./catalog-schemas.js";
import {
  asToolArgs,
  type ContentQueryLike,
  prepareCollectionArgs,
  resolveContentQuery,
  withToolErrorHandling,
} from "./factories.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import type {
  ContentMutationToolFactoryOptions,
  ContentToolFactoryOptions,
  ToolFactoryOptions,
  WordPressAIReadAdapter,
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
 * Resolves a content collection read through the adapter when one is provided,
 * otherwise falls through to the client.
 */
async function executeListContent(
  client: WordPressClient,
  readAdapter: WordPressAIReadAdapter | undefined,
  contentType: string,
  filter: QueryParams,
): Promise<unknown> {
  if (readAdapter?.listContent) {
    return readAdapter.listContent({ contentType, filter });
  }

  return client.content(contentType).list(filter);
}

/**
 * Resolves a single content item read through the adapter when one is
 * provided, otherwise falls through to the client query path.
 */
async function executeGetContent(
  client: WordPressClient,
  readAdapter: WordPressAIReadAdapter | undefined,
  contentType: string,
  merged: Record<string, unknown>,
): Promise<unknown> {
  const contentOpts = merged as {
    includeContent?: boolean;
    includeBlocks?: boolean;
  };
  const id = typeof merged.id === "number" ? merged.id : undefined;
  const slug = typeof merged.slug === "string" ? merged.slug : undefined;

  if (readAdapter?.getContent) {
    return readAdapter.getContent({
      contentType,
      id,
      includeBlocks: contentOpts.includeBlocks,
      includeContent: contentOpts.includeContent,
      slug,
    });
  }

  if (id !== undefined) {
    return resolveContentQuery(
      client.content(contentType).item(id) as unknown as ContentQueryLike<
        WordPressPostLike | undefined
      >,
      contentOpts,
    );
  }

  if (slug !== undefined) {
    return resolveContentQuery(
      client.content(contentType).item(slug) as unknown as ContentQueryLike<
        WordPressPostLike | undefined
      >,
      contentOpts,
    );
  }

  throw createInvalidRequestError("Either id or slug must be provided.");
}

/**
 * AI SDK tool that lists items from a custom content resource.
 */
export const getContentCollectionTool = (
  client: WordPressClient,
  options?: ContentToolFactoryOptions<Record<string, unknown>>,
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
      return executeListContent(
        client,
        options?.readAdapter,
        contentType,
        filter as QueryParams,
      );
    }),
    inputSchema: (options?.inputSchema ??
      createContentCollectionInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that fetches a single custom content item by ID or slug.
 */
export const getContentTool = (
  client: WordPressClient,
  options?: ContentToolFactoryOptions<Record<string, unknown>>,
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
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const contentType = resolveContentType(merged, options);
      return executeGetContent(
        client,
        options?.readAdapter,
        contentType,
        merged,
      );
    }),
    inputSchema: (options?.inputSchema ??
      createContentGetInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that creates a new custom content item.
 */
export const createContentTool = (
  client: WordPressClient,
  options?: ContentMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description: options?.description ?? "Create a new WordPress content item",
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
      return client
        .content(contentType)
        .create(withInput.input as Record<string, unknown>);
    }),
    inputSchema: (options?.inputSchema ??
      createContentCreateInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that updates an existing custom content item.
 */
export const updateContentTool = (
  client: WordPressClient,
  options?: ContentMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description:
      options?.description ?? "Update an existing WordPress content item",
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
      return client
        .content(contentType)
        .update(
          withInput.id as number,
          withInput.input as Record<string, unknown>,
        );
    }),
    inputSchema: (options?.inputSchema ??
      createContentUpdateInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that deletes a custom content item.
 */
export const deleteContentTool = (
  client: WordPressClient,
  options?: ContentMutationToolFactoryOptions<Record<string, unknown>>,
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
