import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { UsersFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs } from './factories.js';
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
  inputSchema: usersCollectionInputSchema,
  execute: async (args) => {
    const filter = prepareCollectionArgs(args as unknown as Record<string, unknown>, options);
    return client.users().list(filter as UsersFilter & QueryParams);
  },
});

/**
 * AI SDK tool that fetches a single user by ID.
 */
export const getUserTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress user by ID',
  inputSchema: simpleGetInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    if (merged.id) return client.users().item(merged.id as number);
    throw new Error('User ID must be provided.');
  },
});

/**
 * AI SDK tool that creates a new WordPress user.
 */
export const createUserTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Create a new WordPress user',
  inputSchema: userCreateInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.users().create(withInput.input as Record<string, unknown>);
  },
});

/**
 * AI SDK tool that updates an existing WordPress user.
 */
export const updateUserTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update an existing WordPress user',
  inputSchema: userUpdateInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.users().update(withInput.id as number, withInput.input as Record<string, unknown>);
  },
});

/**
 * AI SDK tool that deletes a WordPress user.
 */
export const deleteUserTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress user',
  inputSchema: userDeleteInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    return client.users().delete(merged.id as number, {
      force: merged.force as boolean | undefined,
      reassign: merged.reassign as number | undefined,
    });
  },
});
