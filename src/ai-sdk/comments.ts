import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { CommentsFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  commentsCollectionInputSchema,
  simpleGetInputSchema,
  commentCreateInputSchema,
  commentUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress comments.
 */
export const getCommentsTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress comments',
  inputSchema: commentsCollectionInputSchema,
  execute: async (args) => {
    const filter = prepareCollectionArgs(args as unknown as Record<string, unknown>, options);
    return client.comments().list(filter as CommentsFilter & QueryParams);
  },
});

/**
 * AI SDK tool that fetches a single comment by ID.
 */
export const getCommentTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress comment by ID',
  inputSchema: simpleGetInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    if (merged.id) return client.comments().item(merged.id as number);
    throw new Error('Comment ID must be provided.');
  },
});

/**
 * AI SDK tool that creates a new WordPress comment.
 */
export const createCommentTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress comment',
  inputSchema: commentCreateInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.comments().create(withInput.input as Record<string, unknown>);
  },
});

/**
 * AI SDK tool that updates an existing WordPress comment.
 */
export const updateCommentTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress comment',
  inputSchema: commentUpdateInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.comments().update(withInput.id as number, withInput.input as Record<string, unknown>);
  },
});

/**
 * AI SDK tool that deletes a WordPress comment.
 */
export const deleteCommentTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress comment',
  inputSchema: deleteInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    return client.comments().delete(merged.id as number, { force: merged.force as boolean | undefined });
  },
});
