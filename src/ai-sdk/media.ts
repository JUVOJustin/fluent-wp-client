import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import type { MediaFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs } from './merge.js';
import { prepareCollectionArgs } from './factories.js';
import type { ToolFactoryOptions } from './types.js';
import {
  mediaCollectionInputSchema,
  simpleGetInputSchema,
  deleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that searches and filters WordPress media items.
 */
export const getMediaTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Search and filter WordPress media items',
  inputSchema: mediaCollectionInputSchema,
  execute: async (args) => {
    const filter = prepareCollectionArgs(args as unknown as Record<string, unknown>, options);
    return client.media().list(filter as MediaFilter & QueryParams);
  },
});

/**
 * AI SDK tool that fetches a single media item by ID or slug.
 */
export const getMediaItemTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get a single WordPress media item by ID or slug',
  inputSchema: simpleGetInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    if (merged.id) return client.media().item(merged.id as number);
    if (merged.slug) return client.media().item(merged.slug as string);
    throw new Error('Either id or slug must be provided.');
  },
});

/**
 * AI SDK tool that deletes a WordPress media item.
 */
export const deleteMediaTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Delete a WordPress media item',
  inputSchema: deleteInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    return client.media().delete(merged.id as number, { force: merged.force as boolean | undefined });
  },
});
