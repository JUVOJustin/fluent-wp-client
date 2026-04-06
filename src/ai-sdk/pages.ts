import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { PagesFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, resolveContentQuery, type ContentQueryLike, asToolArgs, withToolErrorHandling } from './factories.js';
import type { WordPressPage } from '../schemas.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  pagesCollectionInputSchema,
  contentGetInputSchema,
  postCreateInputSchema,
  postUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress pages.
 */
export const getPagesTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress pages',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: pagesCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.content('pages').list(filter as PagesFilter & QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single WordPress page by ID or slug.
 */
export const getPageTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress page by ID or slug',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: contentGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const contentOpts = merged as { includeContent?: boolean; includeBlocks?: boolean };
    if (merged.id) return resolveContentQuery(client.content('pages').item(merged.id as number) as unknown as ContentQueryLike<WordPressPage | undefined>, contentOpts);
    if (merged.slug) return resolveContentQuery(client.content('pages').item(merged.slug as string) as unknown as ContentQueryLike<WordPressPage | undefined>, contentOpts);
    throw new Error('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new WordPress page.
 */
export const createPageTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress page',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: postCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.content('pages').create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing WordPress page.
 */
export const updatePageTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress page',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: postUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.content('pages').update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a WordPress page.
 */
export const deletePageTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress page',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    return client.content('pages').delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
