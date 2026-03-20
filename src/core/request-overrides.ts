import type { WordPressRequestOptions, WordPressRequestOverrides } from '../client-types.js';
import { createWordPressClientError } from './errors.js';

const AUTH_OVERRIDE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'x-wp-nonce',
  'proxy-authorization',
]);

/**
 * Throws when header overrides include auth-related headers.
 */
export function assertNoAuthHeaderOverrides(
  headers: Record<string, string> | undefined,
  context = 'Request options',
): void {
  if (!headers) {
    return;
  }

  for (const headerName of Object.keys(headers)) {
    if (AUTH_OVERRIDE_HEADER_NAMES.has(headerName.toLowerCase())) {
      throw createWordPressClientError({
        kind: 'AUTH_ERROR',
        message: `${context}: auth header overrides are not supported ('${headerName}'). Create a new WordPressClient with the desired auth settings.`,
        operation: 'applyRequestOverrides',
      });
    }
  }
}

/**
 * Merges per-request non-auth header overrides into one request options object.
 */
export function applyRequestOverrides(
  options: WordPressRequestOptions,
  overrides?: WordPressRequestOverrides,
  context = 'Request options',
): WordPressRequestOptions {
  if (!overrides?.headers) {
    return options;
  }

  assertNoAuthHeaderOverrides(overrides.headers, context);

  return {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(overrides.headers ?? {}),
    },
  };
}
