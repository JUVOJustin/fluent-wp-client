import { z } from 'zod';
import { tool } from 'ai';
import type { WordPressClient } from '../client.js';
import { assertValidWordPressBlocks, parseWordPressBlocks, serializeWordPressBlocks, type WordPressParsedBlock } from '../blocks.js';
import { mergeToolArgs } from './merge.js';
import { asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Input schema for reading blocks from any post-like resource.
 */
export const getBlocksInputSchema = z.object({
  resource: z.string()
    .describe('REST base of the resource, e.g. "posts", "pages", or a custom post type like "books"'),
  id: z.number().int()
    .describe('ID of the item to read blocks from'),
}).describe(
  'Read the Gutenberg block structure of a post-like resource. ' +
  'Requires authentication with edit capabilities for the item.',
);

/**
 * Parsed block schema used in setBlocks input.
 * Defined recursively via z.lazy to support nested inner blocks.
 */
const parsedBlockSchema: z.ZodType<WordPressParsedBlock> = z.lazy(() =>
  z.object({
    blockName: z.string().nullable()
      .describe('Fully qualified block name, e.g. "core/paragraph". Null for classic HTML blocks.'),
    attrs: z.record(z.string(), z.unknown()).nullable()
      .describe('Block attributes as key-value pairs'),
    innerBlocks: z.array(parsedBlockSchema)
      .describe('Nested child blocks'),
    innerHTML: z.string()
      .describe('Serialized HTML content of this block'),
    innerContent: z.array(z.string().nullable())
      .describe('Alternating HTML fragments and null placeholders for inner block positions'),
  }),
);

/**
 * Input schema for writing blocks to any post-like resource.
 */
export const setBlocksInputSchema = z.object({
  resource: z.string()
    .describe('REST base of the resource, e.g. "posts", "pages", or a custom post type like "books"'),
  id: z.number().int()
    .describe('ID of the item to update'),
  blocks: z.array(parsedBlockSchema)
    .describe(
      'Full block tree to write. Serialized to Gutenberg block markup and saved as the item\'s content. ' +
      'This replaces the entire content — always fetch the current blocks first if you want to make partial edits.',
    ),
}).describe(
  'Write a Gutenberg block structure to a post-like resource. ' +
  'Serializes the blocks array to WordPress block markup and saves it as the content field. ' +
  'Requires authentication with edit capabilities for the item.',
);

// ---------------------------------------------------------------------------
// Tool factories
// ---------------------------------------------------------------------------

/**
 * AI SDK tool that reads the parsed Gutenberg block structure of any post-like resource.
 *
 * Fetches the item with `context=edit` (requires auth) and parses the raw
 * block markup into a structured block tree.
 */
export const getBlocksTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ??
    'Read the Gutenberg block structure of a post, page, or custom post type item. Requires edit-level authentication.',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: getBlocksInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const resource = merged.resource as string;
    const id = merged.id as number;

    const content = await client.content(resource).item(id).getContent();
    const raw = content?.raw;
    if (!raw) {
      throw new Error(
        `Raw content unavailable for ${resource}/${id}. ` +
        'Ensure the client is authenticated with edit capabilities for this item.',
      );
    }

    const blocks = await parseWordPressBlocks(raw);
    return { id, resource, blocks };
  }),
});

/**
 * AI SDK tool that writes a Gutenberg block tree to any post-like resource.
 *
 * Serializes the provided blocks array to WordPress block markup and saves it
 * as the item's content via a PATCH update. The entire content is replaced —
 * use `getBlocksTool` first when making partial edits.
 */
export const setBlocksTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ??
    'Write a Gutenberg block structure to a post, page, or custom post type item. Replaces the full content. Requires edit-level authentication.',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: setBlocksInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const resource = merged.resource as string;
    const id = merged.id as number;
    const blocks = merged.blocks as WordPressParsedBlock[];

    await assertValidWordPressBlocks(blocks);

    const rawContent = serializeWordPressBlocks(blocks);

    const result = await client.content(resource).update(id, { content: rawContent });
    return { id, resource, updated: true, result };
  }),
});
