import type { WordPressPostLike } from './schemas.js';
import { createAuthError } from './core/errors.js';

/**
 * Normalized raw content payload returned by content item queries.
 */
export interface WordPressRawContentResult {
  raw: string;
  rendered: string;
  protected: boolean;
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
    throw createAuthError(missingRawMessage, {
      operation: 'content.getContent',
    });
  }

  return {
    raw: value.content.raw,
    rendered: value.content.rendered,
    protected: value.content.protected,
  };
}
