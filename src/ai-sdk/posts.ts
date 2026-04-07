import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { PostsFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, resolveContentQuery, type ContentQueryLike, asToolArgs, withToolErrorHandling } from './factories.js';
import { createInvalidRequestError } from '../core/errors.js';
import type { WordPressPost } from '../schemas.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  postsCollectionInputSchema,
  contentGetInputSchema,
  postCreateInputSchema,
  postUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress posts.
 */
export const getPostsTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress posts',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: postsCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.content('posts').list(filter as PostsFilter & QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single WordPress post by ID or slug,
 * with optional raw content and parsed Gutenberg block expansion.
 */
export const getPostTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress post by ID or slug',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: contentGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const contentOpts = merged as { includeContent?: boolean; includeBlocks?: boolean };

    if (merged.id) {
      return resolveContentQuery(client.content('posts').item(merged.id as number) as unknown as ContentQueryLike<WordPressPost | undefined>, contentOpts);
    }
    if (merged.slug) {
      return resolveContentQuery(client.content('posts').item(merged.slug as string) as unknown as ContentQueryLike<WordPressPost | undefined>, contentOpts);
    }
    throw createInvalidRequestError('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new WordPress post.
 */
export const createPostTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress post',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: postCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.content('posts').create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing WordPress post.
 */
export const updatePostTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress post',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: postUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.content('posts').update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a WordPress post.
 */
export const deletePostTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress post',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    return client.content('posts').delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
