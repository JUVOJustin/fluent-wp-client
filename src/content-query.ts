import type { WordPressBlockParser } from './blocks.js';
import type { WordPressPostLike } from './schemas.js';

/**
 * Normalized raw content payload returned by content item queries.
 */
export interface WordPressRawContentResult {
  raw: string;
  rendered: string;
  protected: boolean;
}

/**
 * Optional overrides supported by one content-item `getBlocks()` call.
 */
export interface WordPressGetBlocksOptions {
  parser?: WordPressBlockParser;
}

/**
 * Resolves raw and rendered content from one post-like API response.
 */
export function resolveWordPressRawContent(
  value: WordPressPostLike,
  missingRawMessage: string,
): WordPressRawContentResult | undefined {
  if (!value.content) {
    return undefined;
  }

  if (value.content.raw === undefined) {
    throw new Error(missingRawMessage);
  }

  return {
    raw: value.content.raw,
    rendered: value.content.rendered,
    protected: value.content.protected,
  };
}
