import type {
  WordPressAuthConfig,
  WordPressAuthHeaders,
  WordPressAuthHeadersProvider,
  WordPressAuthInput,
} from '../auth.js';

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
export type WordPressRequestCallback = (url: string, init: RequestInit) => void | Promise<void>;

/**
 * WordPress client configuration.
 */
export interface WordPressClientConfig {
  baseUrl: string;
  auth?: WordPressAuthConfig;
  authHeader?: string;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
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
  endpoint: string;
  method?: string;
  params?: Record<string, string | string[]>;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  auth?: WordPressAuthInput;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  cookies?: string;
  credentials?: RequestCredentials;
  omitContentType?: boolean;
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
  file: Blob | ArrayBuffer | Uint8Array | string;
  filename: string;
  mimeType?: string;
  title?: string;
  caption?: string;
  description?: string;
  alt_text?: string;
  status?: 'publish' | 'draft' | 'private';
}
