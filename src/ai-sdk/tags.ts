import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { TagsFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  tagsCollectionInputSchema,
  simpleGetInputSchema,
  termCreateInputSchema,
  termUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress tags.
 */
export const getTagsTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress tags',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: tagsCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.terms('tags').list(filter as TagsFilter & QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single tag by ID or slug.
 */
export const getTagTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress tag by ID or slug',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: simpleGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    if (merged.id) return client.terms('tags').item(merged.id as number);
    if (merged.slug) return client.terms('tags').item(merged.slug as string);
    throw new Error('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new WordPress tag.
 */
export const createTagTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress tag',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms('tags').create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing WordPress tag.
 */
export const updateTagTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress tag',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms('tags').update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a WordPress tag.
 */
export const deleteTagTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress tag',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.terms('tags').delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
