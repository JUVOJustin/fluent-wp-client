import type { WordPressRequestOptions } from '../types/client.js';
import type { WordPressRequestOverrides } from '../types/resources.js';

/**
 * Merges per-request header overrides into one request options object.
 * Rejects Authorization header overrides to prevent auth conflicts.
 */
export function applyRequestOverrides(
  options: WordPressRequestOptions,
  overrides?: WordPressRequestOverrides,
): WordPressRequestOptions {
  if (!overrides?.headers) {
    return options;
  }

  const headers = overrides.headers;
  // Check for Authorization header case-insensitively
  const hasAuthHeader = Object.keys(headers).some(
    key => key.toLowerCase() === 'authorization'
  );
  if (hasAuthHeader) {
    throw new Error(
      'auth header overrides are not supported. Use the auth configuration options instead.',
    );
  }

  return {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...headers,
    },
  };
}
