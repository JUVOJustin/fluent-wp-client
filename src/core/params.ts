import type { WordPressWritePayload } from '../types/payloads.js';
import type { QueryParams, SerializedQueryParams } from '../types/resources.js';

/**
 * Converts one filter object to WordPress API query params.
 */
export function filterToParams(
  filter: QueryParams,
  options: {
    applyPerPageDefault?: boolean;
  } = {},
): SerializedQueryParams {
  const params: SerializedQueryParams = {};

  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) {
      continue;
    }

    // `fields` maps to the WordPress `_fields` query parameter.
    const apiKey = key === 'fields' ? '_fields' : key.replace(/([A-Z])/g, '_$1').toLowerCase();

    if (Array.isArray(value)) {
      params[apiKey] = value.map((item) => String(item));
      continue;
    }

    if (typeof value === 'boolean') {
      params[apiKey] = value ? 'true' : 'false';
      continue;
    }

    params[apiKey] = String(value);
  }

  if (options.applyPerPageDefault !== false && params.per_page === undefined) {
    params.per_page = '100';
  }

  return params;
}

/**
 * Removes undefined values before a payload is sent to WordPress.
 */
export function compactPayload<T extends WordPressWritePayload>(input: T): T {
  const payload = {} as T;

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    payload[key as keyof T] = value as T[keyof T];
  }

  return payload;
}
