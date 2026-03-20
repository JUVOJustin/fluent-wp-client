import type {
  WordPressAuthConfig,
  WordPressAuthHeaders,
  WordPressAuthHeadersProvider,
  WordPressAuthInput,
} from './auth.js';
import type { WordPressBlockParser } from './blocks.js';

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
  blockParser?: WordPressBlockParser;
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
 * Per-request transport overrides supported by high-level helper methods.
 */
export interface WordPressRequestOverrides {
  headers?: Record<string, string>;
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
