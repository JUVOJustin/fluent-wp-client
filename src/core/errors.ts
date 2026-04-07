/**
 * Categorizes WordPress client errors so consumers can branch on stable string
 * values when `instanceof` is not available (e.g. serialized logs).
 */
export type WordPressClientErrorKind =
  | 'CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTH_ERROR'
  | 'HTTP_ERROR'
  | 'WP_API_ERROR'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'BLOCK_VALIDATION_ERROR'
  | 'PARSE_ERROR'
  | 'DISCOVERY_ERROR'
  | 'INVALID_REQUEST_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Minimal shape for one schema validation issue.
 */
export interface SchemaValidationIssue {
  message: string;
  path?: ReadonlyArray<string | number | { key: string | number }>;
}

/**
 * Optional context fields accepted by all error constructors and factories.
 * Fields are populated opportunistically — only values available at the throw
 * site are set. Sensitive data (credentials, tokens, cookies, request bodies)
 * is never included.
 */
export interface WordPressErrorContext {
  /** High-level operation name, e.g. `content.list`, `auth.loginWithJwt`. */
  operation?: string;
  /** HTTP method used for the request. */
  method?: string;
  /** Endpoint path (no origin, no query string). */
  endpoint?: string;
  /** WordPress site base URL. */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

/**
 * Base error class for all runtime failures surfaced by the WordPress client.
 *
 * Consumers can catch `WordPressClientError` to handle all client failures, or
 * narrow with `instanceof` on a specific subclass. The `kind` string is also
 * available for serialization and logging.
 */
export class WordPressClientError extends Error {
  override readonly name: string = 'WordPressClientError';
  readonly kind: WordPressClientErrorKind;
  readonly retryable: boolean;
  readonly operation?: string;
  readonly method?: string;
  readonly endpoint?: string;
  readonly baseUrl?: string;

  constructor(
    message: string,
    kind: WordPressClientErrorKind,
    context?: WordPressErrorContext & { retryable?: boolean },
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.kind = kind;
    this.retryable = context?.retryable ?? false;
    this.operation = context?.operation;
    this.method = context?.method;
    this.endpoint = context?.endpoint;
    this.baseUrl = context?.baseUrl;
  }

  /**
   * Returns a plain serializable representation suitable for `JSON.stringify`,
   * structured logging, and cross-boundary error transport.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      kind: this.kind,
      message: this.message,
      retryable: this.retryable,
      ...(this.operation !== undefined && { operation: this.operation }),
      ...(this.method !== undefined && { method: this.method }),
      ...(this.endpoint !== undefined && { endpoint: this.endpoint }),
      ...(this.baseUrl !== undefined && { baseUrl: this.baseUrl }),
    };
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Narrows an unknown caught value to a `WordPressClientError`.
 */
export function isWordPressClientError(value: unknown): value is WordPressClientError {
  return value instanceof WordPressClientError;
}

// ---------------------------------------------------------------------------
// Subclasses
// ---------------------------------------------------------------------------

/**
 * Missing or invalid client configuration (e.g. no fetch implementation,
 * empty auth tokens, malformed nonce values).
 */
export class WordPressConfigError extends WordPressClientError {
  override readonly name = 'WordPressConfigError';

  constructor(message: string, context?: WordPressErrorContext) {
    super(message, 'CONFIG_ERROR', { ...context, retryable: false });
  }
}

/**
 * Network-level fetch failure (DNS resolution, connection refused, etc.).
 */
export class WordPressNetworkError extends WordPressClientError {
  override readonly name = 'WordPressNetworkError';

  constructor(cause: unknown, context?: WordPressErrorContext) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      `WordPress request failed: ${causeMessage}`,
      'NETWORK_ERROR',
      { ...context, retryable: true },
      { cause },
    );
  }
}

/**
 * Request exceeded the configured timeout.
 */
export class WordPressTimeoutError extends WordPressClientError {
  override readonly name = 'WordPressTimeoutError';

  constructor(cause: unknown, context?: WordPressErrorContext) {
    super(
      'WordPress request timed out.',
      'TIMEOUT_ERROR',
      { ...context, retryable: true },
      { cause },
    );
  }
}

/**
 * Authentication precondition failure. Thrown before a request is sent when
 * the client detects that auth is required but not configured.
 */
export class WordPressAuthError extends WordPressClientError {
  override readonly name = 'WordPressAuthError';

  constructor(message: string, context?: WordPressErrorContext) {
    super(message, 'AUTH_ERROR', { ...context, retryable: false });
  }
}

// ---------------------------------------------------------------------------
// HTTP error — covers both WP_API_ERROR and generic HTTP_ERROR
// ---------------------------------------------------------------------------

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
 * Non-2xx HTTP response from the WordPress REST API.
 *
 * When the response body contains a WordPress error payload, `wpCode` and
 * `wpMessage` are populated and `kind` is `WP_API_ERROR`. Otherwise `kind`
 * is `HTTP_ERROR`.
 */
export class WordPressHttpError extends WordPressClientError {
  override readonly name = 'WordPressHttpError';
  readonly status: number;
  readonly statusText: string;
  readonly contentType?: string;
  readonly wpCode?: string;
  readonly wpMessage?: string;
  readonly responseBody?: unknown;

  constructor(
    message: string,
    kind: 'WP_API_ERROR' | 'HTTP_ERROR',
    fields: {
      status: number;
      statusText: string;
      contentType?: string;
      wpCode?: string;
      wpMessage?: string;
      responseBody?: unknown;
      retryable?: boolean;
    },
    context?: WordPressErrorContext,
  ) {
    super(message, kind, { ...context, retryable: fields.retryable });
    this.status = fields.status;
    this.statusText = fields.statusText;
    this.contentType = fields.contentType;
    this.wpCode = fields.wpCode;
    this.wpMessage = fields.wpMessage;
    this.responseBody = fields.responseBody;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      status: this.status,
      statusText: this.statusText,
      ...(this.contentType !== undefined && { contentType: this.contentType }),
      ...(this.wpCode !== undefined && { wpCode: this.wpCode }),
      ...(this.wpMessage !== undefined && { wpMessage: this.wpMessage }),
      ...(this.responseBody !== undefined && { responseBody: this.responseBody }),
    };
  }
}

/**
 * Response body could not be parsed (invalid JSON, unexpected content type).
 */
export class WordPressParseError extends WordPressClientError {
  override readonly name = 'WordPressParseError';
  readonly status?: number;
  readonly statusText?: string;
  readonly contentType?: string;

  constructor(
    cause: unknown,
    fields?: { status?: number; statusText?: string; contentType?: string },
    context?: WordPressErrorContext,
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      `Failed to parse WordPress response: ${causeMessage}`,
      'PARSE_ERROR',
      { ...context, retryable: false },
      { cause },
    );
    this.status = fields?.status;
    this.statusText = fields?.statusText;
    this.contentType = fields?.contentType;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.status !== undefined && { status: this.status }),
      ...(this.statusText !== undefined && { statusText: this.statusText }),
      ...(this.contentType !== undefined && { contentType: this.contentType }),
    };
  }
}

/**
 * Schema or resource discovery failure (resource not found in WordPress
 * types/taxonomies, OPTIONS fetch failed, etc.).
 */
export class WordPressDiscoveryError extends WordPressClientError {
  override readonly name = 'WordPressDiscoveryError';

  constructor(message: string, context?: WordPressErrorContext) {
    super(message, 'DISCOVERY_ERROR', { ...context, retryable: false });
  }
}

/**
 * Invalid request parameters, precondition violations, or malformed input
 * detected before a request is sent.
 */
export class WordPressInvalidRequestError extends WordPressClientError {
  override readonly name = 'WordPressInvalidRequestError';

  constructor(message: string, context?: WordPressErrorContext) {
    super(message, 'INVALID_REQUEST_ERROR', { ...context, retryable: false });
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Creates a `WordPressConfigError` for missing or invalid client configuration.
 */
export function createConfigError(
  message: string,
  context?: WordPressErrorContext,
): WordPressConfigError {
  return new WordPressConfigError(message, context);
}

/**
 * Creates a `WordPressNetworkError` for network-level fetch failures.
 */
export function createNetworkError(
  cause: unknown,
  context?: WordPressErrorContext,
): WordPressNetworkError {
  return new WordPressNetworkError(cause, context);
}

/**
 * Creates a `WordPressTimeoutError` for request timeouts.
 */
export function createTimeoutError(
  cause: unknown,
  context?: WordPressErrorContext,
): WordPressTimeoutError {
  return new WordPressTimeoutError(cause, context);
}

/**
 * Creates a `WordPressAuthError` for authentication precondition failures.
 */
export function createAuthError(
  message: string,
  context?: WordPressErrorContext,
): WordPressAuthError {
  return new WordPressAuthError(message, context);
}

/**
 * Creates a `WordPressHttpError` from a non-2xx HTTP response.
 *
 * Distinguishes `WP_API_ERROR` (WordPress error payload present) from generic
 * `HTTP_ERROR` based on the response body shape.
 */
export function createHttpError(
  response: Response,
  payload: unknown,
  context?: WordPressErrorContext,
): WordPressHttpError {
  const wpError = toWordPressErrorPayload(payload);
  const status = wpError?.data?.status ?? response.status;
  const wpCode = typeof wpError?.code === 'string' ? wpError.code : undefined;
  const wpMessage = typeof wpError?.message === 'string' ? wpError.message : undefined;
  const hasWpPayload = wpCode !== undefined || wpMessage !== undefined;

  const message = wpMessage ?? `WordPress API error: ${response.status} ${response.statusText}`;

  return new WordPressHttpError(
    message,
    hasWpPayload ? 'WP_API_ERROR' : 'HTTP_ERROR',
    {
      status,
      statusText: response.statusText,
      contentType: response.headers.get('Content-Type') ?? undefined,
      wpCode,
      wpMessage,
      responseBody: payload,
      retryable: status === 429 || status >= 500,
    },
    context,
  );
}

/**
 * Creates a `WordPressParseError` for response body parsing failures.
 */
export function createParseError(
  cause: unknown,
  context?: WordPressErrorContext & { status?: number; statusText?: string; contentType?: string },
): WordPressParseError {
  const { status, statusText, contentType, ...baseContext } = context ?? {};
  return new WordPressParseError(cause, { status, statusText, contentType }, baseContext);
}

/**
 * Creates a `WordPressDiscoveryError` for schema/resource discovery failures.
 */
export function createDiscoveryError(
  message: string,
  context?: WordPressErrorContext,
): WordPressDiscoveryError {
  return new WordPressDiscoveryError(message, context);
}

/**
 * Creates a `WordPressInvalidRequestError` for malformed input or precondition
 * violations.
 */
export function createInvalidRequestError(
  message: string,
  context?: WordPressErrorContext,
): WordPressInvalidRequestError {
  return new WordPressInvalidRequestError(message, context);
}

/**
 * Wraps an unknown thrown value as a `WordPressClientError`.
 * Passes through values that are already `WordPressClientError`.
 */
export function normalizeToClientError(
  error: unknown,
  context?: WordPressErrorContext,
): WordPressClientError {
  if (error instanceof WordPressClientError) {
    return error;
  }

  if (error instanceof Error) {
    return new WordPressClientError(
      error.message,
      'UNKNOWN_ERROR',
      { ...context, retryable: false },
      { cause: error },
    );
  }

  return new WordPressClientError(
    typeof error === 'string' ? error : 'An unknown error occurred.',
    'UNKNOWN_ERROR',
    { ...context, retryable: false },
    { cause: error },
  );
}

// ---------------------------------------------------------------------------
// Transport-level helpers
// ---------------------------------------------------------------------------

/**
 * Throws a `WordPressHttpError` when the response status indicates failure.
 * Used by the transport layer as the single HTTP error boundary.
 */
export function throwIfHttpError(
  response: Response,
  payload: unknown,
  context?: WordPressErrorContext,
): void {
  if (response.ok) {
    return;
  }

  throw createHttpError(response, payload, context);
}

/**
 * Classifies a fetch-level error as either a timeout or a network failure.
 *
 * Recognizes `DOMException` with `AbortError` (browsers, Node 18+) and plain
 * `Error` with `TimeoutError` or `AbortError` name (Bun, some Node builds)
 * as timeout signals.
 */
export function classifyFetchError(
  error: unknown,
  context?: WordPressErrorContext,
): WordPressTimeoutError | WordPressNetworkError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createTimeoutError(error, context);
  }

  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return createTimeoutError(error, context);
  }

  return createNetworkError(error, context);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely narrows unknown payload values to the expected WP error shape.
 * Only returns a payload when the object contains at least one of the
 * standard WordPress error fields (`code` or `message`).
 */
function toWordPressErrorPayload(payload: unknown): WordPressErrorPayload | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (!('code' in record) && !('message' in record)) {
    return null;
  }

  return record as WordPressErrorPayload;
}
