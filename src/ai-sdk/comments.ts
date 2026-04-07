import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { CommentsFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import { createInvalidRequestError } from '../core/errors.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  commentsCollectionInputSchema,
  idOnlyGetInputSchema,
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
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: commentsCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.comments().list(filter as CommentsFilter & QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single comment by ID.
 */
export const getCommentTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress comment by ID',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: idOnlyGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    if (merged.id) return client.comments().item(merged.id as number);
    throw createInvalidRequestError('Comment ID must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new WordPress comment.
 */
export const createCommentTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress comment',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: commentCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.comments().create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing WordPress comment.
 */
export const updateCommentTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress comment',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: commentUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.comments().update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a WordPress comment.
 */
export const deleteCommentTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress comment',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
    return client.comments().delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
