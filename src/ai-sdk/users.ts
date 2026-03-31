import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { UsersFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  usersCollectionInputSchema,
  simpleGetInputSchema,
  userCreateInputSchema,
  userUpdateInputSchema,
  userDeleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress users.
 */
export const getUsersTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress users',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: usersCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.users().list(filter as UsersFilter & QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single user by ID or slug.
 */
export const getUserTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress user by ID or slug',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: simpleGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    if (merged.id) return client.users().item(merged.id as number);
    if (merged.slug) return client.users().item(merged.slug as string);
    throw new Error('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new WordPress user.
 */
export const createUserTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress user',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: userCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.users().create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing WordPress user.
 */
export const updateUserTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress user',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: userUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.users().update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a WordPress user.
 */
export const deleteUserTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress user',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: userDeleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.users().delete(merged.id as number, {
      force: merged.force as boolean | undefined,
      reassign: merged.reassign as number | undefined,
    });
  }),
});
