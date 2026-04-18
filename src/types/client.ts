import type {
  WordPressAuthConfig,
  WordPressAuthHeaders,
  WordPressAuthHeadersProvider,
  WordPressAuthInput,
} from "../auth.js";

/**
 * Callback invoked before each HTTP request to implement rate limiting or other custom logic.
 * Receives the request URL and init options. Can return a Promise for async operations.
 *
 * @example
 * ```typescript
 * // Simple rate limiter with 100ms delay between requests
 * const client = new WordPressClient({
 *   baseUrl: 'https://example.com',
 *   onRequest: async (url, init) => {
 *     await new Promise(resolve => setTimeout(resolve, 100));
 *   }
 * });
 *
 * // Token bucket rate limiter
 * const client = new WordPressClient({
 *   baseUrl: 'https://example.com',
 *   onRequest: async (url, init) => {
 *     await rateLimiter.acquireToken();
 *   }
 * });
 * ```
 */
export type WordPressRequestCallback = (
  url: string,
  init: RequestInit,
) => void | Promise<void>;

/**
 * WordPress client configuration.
 *
 * When multiple auth fields are supplied the precedence is:
 *   1. `authHeader` — raw `Authorization` header string, highest priority
 *   2. `auth` — structured credentials (basic, JWT, cookie+nonce, resolver)
 *   3. `authHeaders` — prebuilt header map or async provider, merged onto the request
 *
 * `cookies` and `credentials` layer on top of these for cookie-based sessions.
 */
export interface WordPressClientConfig {
  /** Structured credentials. See {@link WordPressAuthConfig}. */
  auth?: WordPressAuthConfig;
  /** Raw `Authorization` header. Wins over `auth` when both are present. */
  authHeader?: string;
  /** Prebuilt header map or async provider merged onto every request. */
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  baseUrl: string;
  cookies?: string;
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
  /**
   * Callback invoked before each HTTP request. Use this for rate limiting, logging,
   * or other custom request processing. The callback receives the final URL and
   * RequestInit options that will be used for the fetch call.
   */
  onRequest?: WordPressRequestCallback;
}

/**
 * Low-level request options for direct calls to the WordPress REST API.
 */
export interface WordPressRequestOptions {
  auth?: WordPressAuthInput;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  body?: unknown;
  cookies?: string;
  credentials?: RequestCredentials;
  endpoint: string;
  headers?: Record<string, string>;
  method?: string;
  omitContentType?: boolean;
  params?: Record<string, string | string[]>;
  rawBody?: BodyInit;
}

/**
 * Low-level request result with parsed payload and original response metadata.
 */
export interface WordPressRequestResult<T> {
  data: T;
  response: Response;
}

/**
 * Upload payload for the dedicated binary media helper.
 */
export interface WordPressMediaUploadInput {
  alt_text?: string;
  caption?: string;
  description?: string;
  file: Blob | ArrayBuffer | Uint8Array | string;
  filename: string;
  mimeType?: string;
  status?: "publish" | "draft" | "private";
  title?: string;
}
