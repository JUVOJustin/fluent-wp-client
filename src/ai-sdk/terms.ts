import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import { createInvalidRequestError } from '../core/errors.js';
import type { ToolFactoryOptions } from './types.js';
import {
  createTermCollectionInputSchema,
  createTermCreateInputSchema,
  createTermDeleteInputSchema,
  createTermGetInputSchema,
  createTermUpdateInputSchema,
} from './catalog-schemas.js';
import type { TermMutationToolFactoryOptions, TermToolFactoryOptions } from './types.js';

function resolveTaxonomyType(
  merged: Record<string, unknown>,
  options?: { taxonomyType?: string },
): string {
  const taxonomyType = options?.taxonomyType ?? (typeof merged.taxonomyType === 'string' ? merged.taxonomyType : undefined);
  if (!taxonomyType) {
    throw createInvalidRequestError('taxonomyType must be provided either in the tool config or the tool input.');
  }

  return taxonomyType;
}

function stripTaxonomyType(args: Record<string, unknown>): Record<string, unknown> {
  const { taxonomyType: _taxonomyType, ...rest } = args;
  return rest;
}

/**
 * AI SDK tool that lists items from a custom taxonomy.
 */
export const getTermCollectionTool = (
  client: WordPressClient,
  options?: TermToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Search and filter WordPress terms',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createTermCollectionInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const taxonomyType = resolveTaxonomyType(merged, options);
    const filter = prepareCollectionArgs(stripTaxonomyType(merged), options as ToolFactoryOptions<Record<string, unknown>>);
    if (options?.readAdapter?.listTerms) {
      return options.readAdapter.listTerms({ client, taxonomyType, filter: filter as QueryParams });
    }

    return client.terms(taxonomyType).list(filter as QueryParams);
  }),
  });
};

/**
 * AI SDK tool that fetches a single term by ID or slug.
 */
export const getTermTool = (
  client: WordPressClient,
  options?: TermToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Get a single WordPress term by ID or slug',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createTermGetInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const taxonomyType = resolveTaxonomyType(merged, options);
    if (options?.readAdapter?.getTerm) {
      return options.readAdapter.getTerm({
        client,
        taxonomyType,
        id: typeof merged.id === 'number' ? merged.id : undefined,
        slug: typeof merged.slug === 'string' ? merged.slug : undefined,
      });
    }

    if (merged.id) return client.terms(taxonomyType).item(merged.id as number);
    if (merged.slug) return client.terms(taxonomyType).item(merged.slug as string);
    throw createInvalidRequestError('Either id or slug must be provided.');
  }),
  });
};

/**
 * AI SDK tool that creates a new term.
 */
export const createTermTool = (
  client: WordPressClient,
  options?: TermMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Create a new WordPress term',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createTermCreateInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const taxonomyType = resolveTaxonomyType(merged, options);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms(taxonomyType).create(withInput.input as Record<string, unknown>);
  }),
  });
};

/**
 * AI SDK tool that updates an existing term.
 */
export const updateTermTool = (
  client: WordPressClient,
  options?: TermMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Update an existing WordPress term',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createTermUpdateInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const taxonomyType = resolveTaxonomyType(merged, options);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms(taxonomyType).update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
  });
};

/**
 * AI SDK tool that deletes a term.
 */
export const deleteTermTool = (
  client: WordPressClient,
  options?: TermToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Delete a WordPress term',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createTermDeleteInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const taxonomyType = resolveTaxonomyType(merged, options);
    return client.terms(taxonomyType).delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
  });
};
