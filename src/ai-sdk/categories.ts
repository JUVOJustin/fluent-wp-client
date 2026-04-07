import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import { createInvalidRequestError } from '../core/errors.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  categoriesCollectionInputSchema,
  simpleGetInputSchema,
  termCreateInputSchema,
  termUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress categories.
 */
export const getCategoriesTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress categories',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: categoriesCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.terms('categories').list(filter as CategoriesFilter & QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single category by ID or slug.
 */
export const getCategoryTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress category by ID or slug',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: simpleGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    if (merged.id) return client.terms('categories').item(merged.id as number);
    if (merged.slug) return client.terms('categories').item(merged.slug as string);
    throw createInvalidRequestError('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new WordPress category.
 */
export const createCategoryTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress category',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms('categories').create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing WordPress category.
 */
export const updateCategoryTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress category',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms('categories').update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a WordPress category.
 */
export const deleteCategoryTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress category',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    return client.terms('categories').delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
