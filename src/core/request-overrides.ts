import type { WordPressRequestOptions } from '../types/client.js';
import type { WordPressRequestOverrides } from '../types/resources.js';

/**
 * Merges per-request header overrides into one request options object.
 */
export function applyRequestOverrides(
  options: WordPressRequestOptions,
  overrides?: WordPressRequestOverrides,
): WordPressRequestOptions {
  if (!overrides?.headers) {
    return options;
  }

  return {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(overrides.headers ?? {}),
    },
  };
}
