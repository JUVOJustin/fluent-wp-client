import { tool } from "ai";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { QueryParams } from "../types/resources.js";
import {
  createTermCollectionInputSchema,
  createTermDeleteInputSchema,
  createTermGetInputSchema,
  createTermSaveInputSchema,
} from "./catalog-schemas.js";
import {
  asToolArgs,
  normalizeFieldSelection,
  prepareCollectionArgs,
  withToolErrorHandling,
} from "./factories.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import type {
  TermCollectionToolOptions,
  TermDeleteToolOptions,
  TermGetToolOptions,
  TermSaveToolOptions,
  ToolFactoryOptions,
} from "./types.js";

function resolveTaxonomyType(
  merged: Record<string, unknown>,
  options?: { taxonomyType?: string },
): string {
  const taxonomyType =
    options?.taxonomyType ??
    (typeof merged.taxonomyType === "string" ? merged.taxonomyType : undefined);
  if (!taxonomyType) {
    throw createInvalidRequestError(
      "taxonomyType must be provided either in the tool config or the tool input.",
    );
  }

  return taxonomyType;
}

function stripTaxonomyType(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const { taxonomyType: _taxonomyType, ...rest } = args;
  return rest;
}

/**
 * AI SDK tool that lists items from a custom taxonomy.
 *
 * Provide `fetch` to replace the default client call — useful for routing
 * through a cache or live loader. Receives the resolved `taxonomyType` and
 * normalised `filter` after `fixedArgs` have been applied.
 */
export const getTermCollectionTool = (
  client: WordPressClient,
  options?: TermCollectionToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Search and filter WordPress terms",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const taxonomyType = resolveTaxonomyType(merged, options);
      const filter = prepareCollectionArgs(
        stripTaxonomyType(merged),
        options as ToolFactoryOptions<Record<string, unknown>>,
      );

      if (options?.fetch) {
        return options.fetch({ filter: filter as QueryParams, taxonomyType });
      }

      return client.terms(taxonomyType).list(filter as QueryParams);
    }),
    inputSchema: (options?.inputSchema ??
      createTermCollectionInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that fetches a single term by ID or slug.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `taxonomyType`, normalised `id` or `slug`, and any `_fields` selection after
 * `fixedArgs` have been applied.
 */
export const getTermTool = (
  client: WordPressClient,
  options?: TermGetToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ?? "Get a single WordPress term by ID or slug",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = normalizeFieldSelection(
        mergeToolArgs(
          asToolArgs(args as Record<string, unknown>),
          options?.fixedArgs,
        ),
      );
      const taxonomyType = resolveTaxonomyType(merged, options);
      const id = typeof merged.id === "number" ? merged.id : undefined;
      const slug = typeof merged.slug === "string" ? merged.slug : undefined;
      const itemOptions = { fields: merged.fields as string[] | undefined };

      if (options?.fetch) {
        return options.fetch({
          fields: itemOptions.fields,
          id,
          slug,
          taxonomyType,
        });
      }

      if (id !== undefined) {
        return client.terms(taxonomyType).item(id, itemOptions);
      }
      if (slug !== undefined) {
        return client.terms(taxonomyType).item(slug, itemOptions);
      }
      throw createInvalidRequestError("Either id or slug must be provided.");
    }),
    inputSchema: (options?.inputSchema ??
      createTermGetInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that creates or updates a term.
 *
 * Presence of `id` in the model input switches to an update call; omitting
 * `id` routes to a create call. One tool covers both WordPress write modes.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `taxonomyType`, optional `id`, and merged `input` after `fixedInput` has
 * been applied.
 */
export const saveTermTool = (
  client: WordPressClient,
  options?: TermSaveToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Create or update a WordPress term",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const taxonomyType = resolveTaxonomyType(merged, options);
      const withInput = mergeMutationInput(
        merged,
        options?.defaultInput,
        options?.fixedInput,
      );
      const id =
        typeof withInput.id === "number" ? (withInput.id as number) : undefined;
      const input = withInput.input as Record<string, unknown>;

      if (options?.fetch) {
        return options.fetch({ id, input, taxonomyType });
      }

      const resource = client.terms(taxonomyType);
      return id === undefined
        ? resource.create(input)
        : resource.update(id, input);
    }),
    inputSchema: (options?.inputSchema ??
      createTermSaveInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that deletes a term.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `taxonomyType`, `id`, and optional `force` flag.
 */
export const deleteTermTool = (
  client: WordPressClient,
  options?: TermDeleteToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Delete a WordPress term",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const taxonomyType = resolveTaxonomyType(merged, options);

      if (options?.fetch) {
        return options.fetch({
          force: merged.force as boolean | undefined,
          id: merged.id as number,
          taxonomyType,
        });
      }

      return client.terms(taxonomyType).delete(merged.id as number, {
        force: merged.force as boolean | undefined,
      });
    }),
    inputSchema: (options?.inputSchema ??
      createTermDeleteInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};
