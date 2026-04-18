import { createAuthError } from "./core/errors.js";
import type { WordPressPostLike } from "./schemas.js";

/**
 * Normalized raw content payload returned by content item queries.
 */
export interface WordPressRawContentResult {
  protected: boolean;
  raw: string;
  rendered: string;
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
      operation: "content.getContent",
    });
  }

  return {
    protected: value.content.protected,
    raw: value.content.raw,
    rendered: value.content.rendered,
  };
}
