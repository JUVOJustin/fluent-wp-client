/**
 * Minimal shape for WordPress REST API error payloads.
 */
export interface WordPressErrorPayload {
  code?: string;
  message?: string;
  data?: {
    status?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Structured error class used for failed WordPress API responses.
 */
export class WordPressApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly code: string | null;
  public readonly responseBody: unknown;

  constructor(config: {
    status: number;
    statusText: string;
    message: string;
    code?: string | null;
    responseBody?: unknown;
  }) {
    super(config.message);
    this.name = 'WordPressApiError';
    this.status = config.status;
    this.statusText = config.statusText;
    this.code = config.code ?? null;
    this.responseBody = config.responseBody;
  }
}

/**
 * Safely narrows unknown payload values to the expected WP error shape.
 */
function toWordPressErrorPayload(payload: unknown): WordPressErrorPayload | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  return payload as WordPressErrorPayload;
}

/**
 * Builds one typed `WordPressApiError` from a failed response and payload.
 */
export function createWordPressApiError(response: Response, payload: unknown): WordPressApiError {
  const wpError = toWordPressErrorPayload(payload);
  const status = wpError?.data?.status ?? response.status;
  const code = typeof wpError?.code === 'string' ? wpError.code : null;
  const message = typeof wpError?.message === 'string'
    ? wpError.message
    : `WordPress API error: ${response.status} ${response.statusText}`;

  return new WordPressApiError({
    status,
    statusText: response.statusText,
    message,
    code,
    responseBody: payload,
  });
}

/**
 * Throws a typed API error when the response status indicates failure.
 */
export function throwIfWordPressError(response: Response, payload: unknown): void {
  if (response.ok) {
    return;
  }

  throw createWordPressApiError(response, payload);
}
