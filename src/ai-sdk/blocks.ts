import { tool } from "ai";
import { z } from "zod";
import {
  assertValidWordPressBlocks,
  parseWordPressBlocks,
  serializeWordPressBlocks,
  type WordPressParsedBlock,
} from "../blocks.js";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { WordPressDiscoveryCatalog } from "../types/discovery.js";
import { asToolArgs, withToolErrorHandling } from "./factories.js";
import { mergeToolArgs } from "./merge.js";
import type {
  ContentMutationToolFactoryOptions,
  ContentToolFactoryOptions,
} from "./types.js";

function createContentTypeSelector(catalog?: WordPressDiscoveryCatalog) {
  const contentTypes = Object.keys(catalog?.content ?? {});
  if (contentTypes.length === 1) {
    return z.literal(contentTypes[0]);
  }

  if (contentTypes.length > 1) {
    return z.enum(contentTypes as [string, ...string[]]);
  }

  return z.string();
}

function createBlocksReadInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  contentType?: string;
}) {
  if (config.contentType) {
    return z
      .object({
        id: z.number().int().describe("ID of the item to read blocks from"),
      })
      .describe(
        `Read the Gutenberg block structure of a ${config.contentType} item`,
      );
  }

  return z
    .object({
      contentType: createContentTypeSelector(config.catalog).describe(
        "REST base of the post-like resource, e.g. posts, pages, or books",
      ),
      id: z.number().int().describe("ID of the item to read blocks from"),
    })
    .describe(
      "Read the Gutenberg block structure of a post-like resource. Requires authentication with edit capabilities for the item.",
    );
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Input schema for reading blocks from any post-like resource.
 */
export const getBlocksInputSchema = z
  .object({
    contentType: z
      .string()
      .describe(
        'REST base of the resource, e.g. "posts", "pages", or a custom post type like "books"',
      ),
    id: z.number().int().describe("ID of the item to read blocks from"),
  })
  .describe(
    "Read the Gutenberg block structure of a post-like resource. " +
      "Requires authentication with edit capabilities for the item.",
  );

/**
 * Parsed block schema used in setBlocks input.
 * Defined recursively via z.lazy to support nested inner blocks.
 */
const parsedBlockSchema: z.ZodType<WordPressParsedBlock> = z.lazy(() =>
  z.object({
    attrs: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe("Block attributes as key-value pairs"),
    blockName: z
      .string()
      .nullable()
      .describe(
        'Fully qualified block name, e.g. "core/paragraph". Null for classic HTML blocks.',
      ),
    innerBlocks: z.array(parsedBlockSchema).describe("Nested child blocks"),
    innerContent: z
      .array(z.string().nullable())
      .describe(
        "Alternating HTML fragments and null placeholders for inner block positions",
      ),
    innerHTML: z.string().describe("Serialized HTML content of this block"),
  }),
);

/**
 * Input schema for writing blocks to any post-like resource.
 */
export const setBlocksInputSchema = z
  .object({
    blocks: z
      .array(parsedBlockSchema)
      .describe(
        "Full block tree to write. Serialized to Gutenberg block markup and saved as the item's content. " +
          "This replaces the entire content — always fetch the current blocks first if you want to make partial edits.",
      ),
    contentType: z
      .string()
      .describe(
        'REST base of the resource, e.g. "posts", "pages", or a custom post type like "books"',
      ),
    id: z.number().int().describe("ID of the item to update"),
  })
  .describe(
    "Write a Gutenberg block structure to a post-like resource. " +
      "Serializes the blocks array to WordPress block markup and saves it as the content field. " +
      "Requires authentication with edit capabilities for the item.",
  );

function createBlocksWriteInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  contentType?: string;
}) {
  if (config.contentType) {
    return z
      .object({
        blocks: setBlocksInputSchema.shape.blocks,
        id: z.number().int().describe("ID of the item to update"),
      })
      .describe(`Write Gutenberg blocks to a ${config.contentType} item`);
  }

  return z
    .object({
      blocks: setBlocksInputSchema.shape.blocks,
      contentType: createContentTypeSelector(config.catalog).describe(
        "REST base of the post-like resource, e.g. posts, pages, or books",
      ),
      id: z.number().int().describe("ID of the item to update"),
    })
    .describe(
      setBlocksInputSchema.description ??
        "Write a Gutenberg block structure to a post-like resource",
    );
}

function resolveContentType(
  merged: Record<string, unknown>,
  options?: { contentType?: string },
): string {
  const contentType =
    options?.contentType ??
    (typeof merged.contentType === "string" ? merged.contentType : undefined);
  if (!contentType) {
    throw createInvalidRequestError(
      "contentType must be provided either in the tool config or the tool input.",
    );
  }

  return contentType;
}

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
  options?: ContentToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description:
      options?.description ??
      "Read the Gutenberg block structure of a post, page, or custom post type item. Requires edit-level authentication.",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const contentType = resolveContentType(merged, options);
      const id = merged.id as number;

      const content = await client.content(contentType).item(id).getContent();
      const raw = content?.raw;
      if (!raw) {
        throw createInvalidRequestError(
          `Raw content unavailable for ${contentType}/${id}. ` +
            "Ensure the client is authenticated with edit capabilities for this item.",
        );
      }

      const blocks = await parseWordPressBlocks(raw);
      return { blocks, contentType, id };
    }),
    inputSchema: (options?.inputSchema ??
      createBlocksReadInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that writes a Gutenberg block tree to any post-like resource.
 *
 * Serializes the provided blocks array to WordPress block markup and saves it
 * as the item's content via a PATCH update. The entire content is replaced —
 * use `getBlocksTool` first when making partial edits.
 */
export const setBlocksTool = (
  client: WordPressClient,
  options?: ContentMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    description:
      options?.description ??
      "Write a Gutenberg block structure to a post, page, or custom post type item. Replaces the full content. Requires edit-level authentication.",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const contentType = resolveContentType(merged, options);
      const id = merged.id as number;
      const blocks = merged.blocks as WordPressParsedBlock[];

      await assertValidWordPressBlocks(blocks);

      const rawContent = serializeWordPressBlocks(blocks);

      const result = await client
        .content(contentType)
        .update(id, { content: rawContent });
      return { contentType, id, result, updated: true };
    }),
    inputSchema: (options?.inputSchema ??
      createBlocksWriteInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};
