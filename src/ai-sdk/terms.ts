import { tool } from "ai";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { QueryParams } from "../types/resources.js";
import {
  createTermCollectionInputSchema,
  createTermCreateInputSchema,
  createTermDeleteInputSchema,
  createTermGetInputSchema,
  createTermUpdateInputSchema,
} from "./catalog-schemas.js";
import {
  asToolArgs,
  prepareCollectionArgs,
  withToolErrorHandling,
} from "./factories.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import type {
  TermCollectionToolOptions,
  TermGetToolOptions,
  TermMutationToolFactoryOptions,
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
 * `taxonomyType` and normalised `id` or `slug` after `fixedArgs` have been
 * applied.
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
    description:
      options?.description ?? "Get a single WordPress term by ID or slug",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const taxonomyType = resolveTaxonomyType(merged, options);
      const id = typeof merged.id === "number" ? merged.id : undefined;
      const slug = typeof merged.slug === "string" ? merged.slug : undefined;

      if (options?.fetch) {
        return options.fetch({ id, slug, taxonomyType });
      }

      if (id !== undefined) return client.terms(taxonomyType).item(id);
      if (slug !== undefined) return client.terms(taxonomyType).item(slug);
      throw createInvalidRequestError("Either id or slug must be provided.");
    }),
    inputSchema: (options?.inputSchema ??
      createTermGetInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that creates a new term.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `taxonomyType` and merged `input` after `fixedInput` has been applied.
 */
export const createTermTool = (
  client: WordPressClient,
  options?: TermMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description: options?.description ?? "Create a new WordPress term",
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

      if (options?.fetch) {
        return options.fetch({ input: withInput.input, taxonomyType });
      }

      return client
        .terms(taxonomyType)
        .create(withInput.input as Record<string, unknown>);
    }),
    inputSchema: (options?.inputSchema ??
      createTermCreateInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that updates an existing term.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `taxonomyType`, `id`, and merged `input` after `fixedInput` has been applied.
 */
export const updateTermTool = (
  client: WordPressClient,
  options?: TermMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description: options?.description ?? "Update an existing WordPress term",
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

      if (options?.fetch) {
        return options.fetch({
          id: withInput.id,
          input: withInput.input,
          taxonomyType,
        });
      }

      return client
        .terms(taxonomyType)
        .update(
          withInput.id as number,
          withInput.input as Record<string, unknown>,
        );
    }),
    inputSchema: (options?.inputSchema ??
      createTermUpdateInputSchema(resolvedOptions)) as never,
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
  options?: TermMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description: options?.description ?? "Delete a WordPress term",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const taxonomyType = resolveTaxonomyType(merged, options);

      if (options?.fetch) {
        return options.fetch({
          force: merged.force,
          id: merged.id,
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
