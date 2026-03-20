/**
 * Shared error kind taxonomy used across all client operations.
 */
export type WordPressClientErrorKind =
  | 'CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTH_ERROR'
  | 'HTTP_ERROR'
  | 'WP_API_ERROR'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Context fields attached to one thrown client error.
 */
export interface WordPressErrorContext {
  operation?: string;
  method?: string;
  endpoint?: string;
}

/**
 * Constructor input used by the shared client error class.
 */
export interface WordPressClientErrorConfig extends WordPressErrorContext {
  kind: WordPressClientErrorKind;
  message: string;
  status?: number;
  cause?: unknown;
}

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
 * Shared typed error used by all non-successful client operations.
 */
export class WordPressClientError extends Error {
  public readonly kind: WordPressClientErrorKind;
  public readonly operation: string | undefined;
  public readonly method: string | undefined;
  public readonly endpoint: string | undefined;
  public readonly status: number | undefined;
  public readonly cause: unknown;

  constructor(config: WordPressClientErrorConfig) {
    super(config.message);
    this.name = 'WordPressClientError';
    this.kind = config.kind;
    this.operation = config.operation;
    this.method = config.method;
    this.endpoint = config.endpoint;
    this.status = config.status;
    this.cause = config.cause;
  }
}

/**
 * Structured error class used for failed WordPress REST API responses.
 */
export class WordPressApiError extends WordPressClientError {
  public readonly statusText: string;
  public readonly code: string | null;
  public readonly responseBody: unknown;

  constructor(config: {
    status: number;
    statusText: string;
    message: string;
    code?: string | null;
    responseBody?: unknown;
    operation?: string;
    method?: string;
    endpoint?: string;
    cause?: unknown;
  }) {
    super({
      kind: 'WP_API_ERROR',
      message: config.message,
      status: config.status,
      operation: config.operation,
      method: config.method,
      endpoint: config.endpoint,
      cause: config.cause,
    });
    this.name = 'WordPressApiError';
    this.statusText = config.statusText;
    this.code = config.code ?? null;
    this.responseBody = config.responseBody;
  }
}

/**
 * Normalizes unknown method input for stable diagnostics.
 */
function normalizeMethod(method: string | undefined): string | undefined {
  if (!method) {
    return undefined;
  }

  return method.toUpperCase();
}

/**
 * Converts one endpoint string to a safe path-only diagnostic value.
 */
function normalizeEndpoint(endpoint: string | undefined): string | undefined {
  if (!endpoint) {
    return undefined;
  }

  if (!/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  try {
    const url = new URL(endpoint);
    return url.pathname;
  } catch {
    return endpoint;
  }
}

/**
 * Applies shared normalization to one optional error context object.
 */
function normalizeContext(context: WordPressErrorContext | undefined): WordPressErrorContext {
  if (!context) {
    return {};
  }

  return {
    operation: context.operation,
    method: normalizeMethod(context.method),
    endpoint: normalizeEndpoint(context.endpoint),
  };
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
 * Detects payloads that represent native WordPress error responses.
 */
function isWordPressErrorPayload(payload: unknown): payload is WordPressErrorPayload {
  const wpError = toWordPressErrorPayload(payload);

  if (!wpError) {
    return false;
  }

  return typeof wpError.code === 'string' && typeof wpError.message === 'string';
}

/**
 * Builds one shared client error for non-WP-specific failure scenarios.
 */
export function createWordPressClientError(config: WordPressClientErrorConfig): WordPressClientError {
  const context = normalizeContext(config);

  return new WordPressClientError({
    ...config,
    method: context.method,
    endpoint: context.endpoint,
  });
}

/**
 * Builds one typed `WordPressApiError` from a failed response and payload.
 */
export function createWordPressApiError(
  response: Response,
  payload: unknown,
  context?: WordPressErrorContext,
): WordPressApiError {
  const wpError = toWordPressErrorPayload(payload);
  const normalizedContext = normalizeContext(context);
  const status = typeof wpError?.data?.status === 'number' ? wpError.data.status : response.status;
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
    operation: normalizedContext.operation,
    method: normalizedContext.method,
    endpoint: normalizedContext.endpoint,
  });
}

/**
 * Builds one typed HTTP error for non-WordPress response payload failures.
 */
export function createWordPressHttpError(response: Response, context?: WordPressErrorContext): WordPressClientError {
  const normalizedContext = normalizeContext(context);

  return createWordPressClientError({
    kind: 'HTTP_ERROR',
    message: `HTTP error: ${response.status} ${response.statusText}`,
    status: response.status,
    operation: normalizedContext.operation,
    method: normalizedContext.method,
    endpoint: normalizedContext.endpoint,
  });
}

/**
 * Checks whether one local transport exception likely represents a timeout.
 */
export function isTimeoutLikeError(cause: unknown): boolean {
  if (!(cause instanceof Error)) {
    return false;
  }

  return cause.name === 'AbortError' || cause.name === 'TimeoutError';
}

/**
 * Throws one typed error when the response status indicates failure.
 */
export function throwIfWordPressError(
  response: Response,
  payload: unknown,
  context?: WordPressErrorContext,
): void {
  if (response.ok) {
    return;
  }

  if (isWordPressErrorPayload(payload)) {
    throw createWordPressApiError(response, payload, context);
  }

  throw createWordPressHttpError(response, context);
}
