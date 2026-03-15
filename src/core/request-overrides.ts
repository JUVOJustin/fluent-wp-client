import type { WordPressRequestOptions, WordPressRequestOverrides } from '../client-types.js';

const AUTH_OVERRIDE_FIELD_NAMES = ['auth', 'authHeaders', 'cookies', 'credentials'] as const;
const AUTH_OVERRIDE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'x-wp-nonce',
  'proxy-authorization',
]);

/**
 * Throws when request options attempt to override authentication behavior.
 */
export function assertNoAuthOverrides(
  config: {
    headers?: Record<string, string>;
    auth?: unknown;
    authHeaders?: unknown;
    cookies?: unknown;
    credentials?: unknown;
  } | undefined,
  context = 'Request options',
): void {
  if (!config) {
    return;
  }

  for (const fieldName of AUTH_OVERRIDE_FIELD_NAMES) {
    if (config[fieldName] !== undefined) {
      throw new Error(`${context}: auth overrides are not supported. Create a new WordPressClient with the desired auth settings.`);
    }
  }

  for (const headerName of Object.keys(config.headers ?? {})) {
    if (AUTH_OVERRIDE_HEADER_NAMES.has(headerName.toLowerCase())) {
      throw new Error(`${context}: auth header overrides are not supported ('${headerName}'). Create a new WordPressClient with the desired auth settings.`);
    }
  }
}

/**
 * Merges per-request header overrides into one request options object.
 */
export function applyRequestOverrides(
  options: WordPressRequestOptions,
  overrides?: WordPressRequestOverrides,
  context = 'Request options',
): WordPressRequestOptions {
  if (!overrides) {
    return options;
  }

  assertNoAuthOverrides(overrides as Record<string, unknown> & { headers?: Record<string, string> }, context);

  return {
    ...options,
    ...overrides,
    headers: {
      ...(options.headers ?? {}),
      ...(overrides.headers ?? {}),
    },
  };
}
