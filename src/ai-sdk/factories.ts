import type { WordPressClient } from '../client.js';
import type { WordPressPostBase } from '../schemas.js';
import { parseWordPressBlocks, type WordPressParsedBlock } from '../blocks.js';
import type { WordPressRawContentResult } from '../content-query.js';
import { mergeToolArgs } from './merge.js';
import type { ToolFactoryOptions } from './types.js';

// ---------------------------------------------------------------------------
// Field normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes `_fields` alias to `fields` so the client's `filterToParams`
 * maps it correctly to the WordPress `_fields` query parameter.
 */
export function normalizeFieldSelection(args: Record<string, unknown>): Record<string, unknown> {
  const result = { ...args };
  if (result._fields && !result.fields) {
    result.fields = result._fields;
  }
  delete result._fields;
  return result;
}

/**
 * Merges tool options and normalizes field selection in one step.
 */
export function prepareCollectionArgs(
  modelArgs: Record<string, unknown>,
  options?: ToolFactoryOptions<Record<string, unknown>>,
): Record<string, unknown> {
  const merged = mergeToolArgs(
    options?.defaultArgs ?? {},
    modelArgs,
    options?.fixedArgs,
  );
  return normalizeFieldSelection(merged);
}

// ---------------------------------------------------------------------------
// Content query envelope
// ---------------------------------------------------------------------------

/**
 * Envelope returned by post-like single getter tools.
 */
export interface ContentItemResult<T> {
  item: T;
  content?: WordPressRawContentResult;
  blocks?: WordPressParsedBlock[];
}

/**
 * Resolves a WordPressContentQuery into a plain serializable envelope.
 */
export interface ContentQueryLike<TContent extends WordPressPostBase | undefined> {
  then<TResult1 = TContent, TResult2 = never>(
    onfulfilled?: ((value: TContent) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  getContent(): Promise<WordPressRawContentResult | undefined>;
}

/**
 * Resolves a post-like item query into a plain serializable envelope.
 */
export async function resolveContentQuery<TContent extends WordPressPostBase | undefined>(
  query: ContentQueryLike<TContent>,
  args: { includeContent?: boolean; includeBlocks?: boolean },
): Promise<ContentItemResult<TContent> | undefined> {
  const item = await query;
  if (item === undefined) return undefined;

  let content: WordPressRawContentResult | undefined;
  if (args.includeContent || args.includeBlocks) {
    content = await query.getContent() ?? undefined;
  }

  let blocks: WordPressParsedBlock[] | undefined;
  if (args.includeBlocks) {
    blocks = content?.raw ? await parseWordPressBlocks(content.raw) : undefined;
  }

  return { item, content, blocks };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { ContentItemResult as WordPressAIContentItemResult };
