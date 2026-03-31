import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import {
  termCollectionInputSchema,
  simpleGetInputSchema,
  termCreateInputSchema,
  termUpdateInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that lists items from a custom taxonomy.
 */
export const getTermCollectionTool = (
  client: WordPressClient,
  resource: string,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Search and filter WordPress ${resource}`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termCollectionInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const filter = prepareCollectionArgs(asToolArgs(args), options);
    return client.terms(resource).list(filter as QueryParams);
  }),
});

/**
 * AI SDK tool that fetches a single term by ID or slug.
 */
export const getTermTool = (
  client: WordPressClient,
  resource: string,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Get a single WordPress ${resource} term by ID or slug`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: simpleGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    if (merged.id) return client.terms(resource).item(merged.id as number);
    if (merged.slug) return client.terms(resource).item(merged.slug as string);
    throw new Error('Either id or slug must be provided.');
  }),
});

/**
 * AI SDK tool that creates a new term.
 */
export const createTermTool = (
  client: WordPressClient,
  resource: string,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Create a new WordPress ${resource} term`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termCreateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms(resource).create(withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that updates an existing term.
 */
export const updateTermTool = (
  client: WordPressClient,
  resource: string,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Update an existing WordPress ${resource} term`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: termUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.terms(resource).update(withInput.id as number, withInput.input as Record<string, unknown>);
  }),
});

/**
 * AI SDK tool that deletes a term.
 */
export const deleteTermTool = (
  client: WordPressClient,
  resource: string,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? `Delete a WordPress ${resource} term`,
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: deleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.terms(resource).delete(merged.id as number, { force: merged.force as boolean | undefined });
  }),
});
