import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, resolveContentQuery, type ContentQueryLike, asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import type { WordPressPostLike } from '../schemas.js';
import {
  contentCollectionInputSchema,
  contentGetInputSchema,
  contentCreateInputSchema,
  contentUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that lists items from a custom content resource.
 */
export const getContentCollectionTool = (
  client: WordPressClient,
  resource: string,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Search and filter WordPress ${resource}`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: contentCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.content(resource).list(filter as QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single custom content item by ID or slug.
 */
export const getContentTool = (
  client: WordPressClient,
  resource: string,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Get a single WordPress ${resource} item by ID or slug`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: contentGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const contentOpts = merged as { includeContent?: boolean; includeBlocks?: boolean };
    if (merged.id) {
      return resolveContentQuery(
        client.content(resource).item(merged.id as number) as unknown as ContentQueryLike<WordPressPostLike | undefined>,
        contentOpts,
      );
    }
    if (merged.slug) {
      return resolveContentQuery(
        client.content(resource).item(merged.slug as string) as unknown as ContentQueryLike<WordPressPostLike | undefined>,
        contentOpts,
      );
    }
    throw new Error('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new custom content item.
 */
export const createContentTool = (
  client: WordPressClient,
  resource: string,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Create a new WordPress ${resource} item`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: contentCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.content(resource).create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing custom content item.
 */
export const updateContentTool = (
  client: WordPressClient,
  resource: string,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Update an existing WordPress ${resource} item`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: contentUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.content(resource).update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a custom content item.
 */
export const deleteContentTool = (
  client: WordPressClient,
  resource: string,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Delete a WordPress ${resource} item`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.content(resource).delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
