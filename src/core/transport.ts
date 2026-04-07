import {
  createJwtAuthHeader,
  resolveWordPressRequestCredentials,
  resolveWordPressRequestHeaders,
  type JwtAuthCredentials,
  type JwtAuthTokenResponse,
  type JwtAuthValidationResponse,
  type JwtLoginCredentials,
  type WordPressAuthHeaders,
  type WordPressAuthHeadersProvider,
  type WordPressAuthInput,
} from '../auth.js';
import type { WordPressRequestOptions, WordPressRequestResult, WordPressMediaUploadInput } from '../types/client.js';
import type { WordPressRequestCallback } from '../types/client.js';
import type { WordPressRequestOverrides, FetchResult } from '../types/resources.js';
import {
  classifyFetchError,
  createConfigError,
  createInvalidRequestError,
  createParseError,
  normalizeToClientError,
  throwIfHttpError,
} from './errors.js';
import { applyRequestOverrides } from './request-overrides.js';

/**
 * Configuration for the WordPress transport layer.
 */
export interface WordPressTransportConfig {
  baseUrl: string;
  auth?: WordPressAuthInput;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  cookies?: string;
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
  /**
   * Callback invoked before each HTTP request for rate limiting or custom logic.
   */
  onRequest?: WordPressRequestCallback;
}

/**
 * Transport layer for WordPress REST API requests.
 *
 * All HTTP, network, and parse failures are surfaced as `WordPressClientError`
 * so callers never need to inspect raw `Response` status or catch platform errors.
 */
export class WordPressTransport {
  private readonly baseUrl: string;
  private readonly baseOrigin: string;
  private readonly apiBase: string;
  private readonly auth: WordPressAuthInput | undefined;
  private readonly authHeaders: WordPressAuthHeaders | WordPressAuthHeadersProvider | undefined;
  private readonly cookieHeader: string | undefined;
  private readonly defaultHeaders: Record<string, string>;
  private readonly requestCredentials: RequestCredentials | undefined;
  private readonly fetcher: typeof fetch | undefined;
  private readonly onRequest: WordPressRequestCallback | undefined;

  constructor(config: WordPressTransportConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.baseOrigin = new URL(this.baseUrl).origin;
    this.auth = config.auth;
    this.authHeaders = config.authHeaders;
    this.cookieHeader = config.cookies;
    this.defaultHeaders = {};
    this.requestCredentials = config.credentials;
    this.fetcher = config.fetch;
    this.apiBase = `${this.baseUrl}/wp-json/wp/v2`;
    this.onRequest = config.onRequest;
  }

  /**
   * Returns whether authentication is configured on this transport instance.
   */
  hasAuth(): boolean {
    return this.auth !== undefined || this.authHeaders !== undefined || this.cookieHeader !== undefined;
  }

  /**
   * Sets headers used by all subsequent requests from this transport instance.
   */
  setHeaders(name: string, value: string): this;
  setHeaders(headers: Record<string, string>): this;
  setHeaders(nameOrHeaders: string | Record<string, string>, value?: string): this {
    if (typeof nameOrHeaders === 'string') {
      this.defaultHeaders[nameOrHeaders] = value ?? '';
      return this;
    }

    Object.assign(this.defaultHeaders, nameOrHeaders);
    return this;
  }

  /**
   * Rejects absolute URLs that do not target the configured WordPress origin.
   */
  private createAbsoluteApiUrl(endpoint: string): URL {
    const url = new URL(endpoint);

    if (url.origin !== this.baseOrigin) {
      throw createInvalidRequestError(
        `Cross-origin absolute URLs are not allowed. Expected origin '${this.baseOrigin}' but received '${url.origin}'.`,
        { endpoint, baseUrl: this.baseUrl },
      );
    }

    return url;
  }

  /**
   * Builds one REST URL from endpoint and query params.
   */
  createApiUrl(endpoint: string, params: Record<string, string | string[]> = {}): URL {
    const url = /^https?:\/\//i.test(endpoint)
      ? this.createAbsoluteApiUrl(endpoint)
      : endpoint.startsWith('/wp-json/')
        ? new URL(`${this.baseUrl}${endpoint}`)
        : new URL(`${this.apiBase}${endpoint}`);

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(`${key}[]`, item);
        }
      } else {
        url.searchParams.append(key, value);
      }
    }

    return url;
  }

  /**
   * Resolves one endpoint and params pair into an absolute URL string.
   */
  createApiUrlString(endpoint: string, params: Record<string, string | string[]> = {}): string {
    return this.createApiUrl(endpoint, params).toString();
  }

  /**
   * Normalizes a namespace + resource pair to one request endpoint.
   */
  createNamespacedEndpoint(resource: string, namespace = 'wp/v2'): string {
    const normalizedNamespace = namespace.replace(/^\/+|\/+$/g, '');
    const normalizedResource = resource.replace(/^\/+|\/+$/g, '');

    if (!normalizedResource) {
      throw createInvalidRequestError('Resource path must not be empty.', {
        baseUrl: this.baseUrl,
      });
    }

    if (normalizedNamespace === 'wp/v2') {
      return `/${normalizedResource}`;
    }

    return `/wp-json/${normalizedNamespace}/${normalizedResource}`;
  }

  /**
   * Checks whether one header name exists in a header map.
   */
  private hasHeader(headers: Record<string, string>, headerName: string): boolean {
    const expected = headerName.toLowerCase();

    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === expected) {
        return true;
      }
    }

    return false;
  }

  /**
   * Serializes request body input to one final body value.
   */
  private serializeBody(options: {
    body?: unknown;
    rawBody?: BodyInit;
  }): {
    body: BodyInit | undefined;
    isJsonBody: boolean;
  } {
    if (options.rawBody !== undefined) {
      return {
        body: options.rawBody,
        isJsonBody: false,
      };
    }

    if (options.body === undefined || options.body === null) {
      return {
        body: undefined,
        isJsonBody: false,
      };
    }

    if (typeof options.body === 'string') {
      return {
        body: options.body,
        isJsonBody: false,
      };
    }

    return {
      body: JSON.stringify(options.body),
      isJsonBody: true,
    };
  }

  /**
   * Resolves final request headers from auth, cookies, and caller-provided headers.
   */
  private async resolveRequestHeaders(config: {
    method: string;
    url: URL;
    body?: BodyInit;
    isJsonBody: boolean;
    omitContentType?: boolean;
    auth?: WordPressAuthInput;
    authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
    cookies?: string;
    headers?: Record<string, string>;
  }): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    Object.assign(
      headers,
      await resolveWordPressRequestHeaders({
        auth: config.auth,
        authHeaders: config.authHeaders,
        request: {
          method: config.method,
          url: config.url,
          body: config.body,
        },
      }),
    );

    if (config.cookies) {
      headers.Cookie = config.cookies;
    }

    Object.assign(headers, this.defaultHeaders);

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    if (
      config.isJsonBody
      && !config.omitContentType
      && !this.hasHeader(headers, 'Content-Type')
    ) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * Parses one REST response payload based on returned content type.
   * Wraps parse failures as `WordPressClientError` with `PARSE_ERROR` kind.
   */
  private async parseResponseBody(response: Response, diagnostics: { method: string; endpoint: string }): Promise<unknown> {
    const contentType = response.headers.get('Content-Type')?.toLowerCase() || '';

    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      throw createParseError(error, {
        method: diagnostics.method,
        endpoint: diagnostics.endpoint,
        baseUrl: this.baseUrl,
        status: response.status,
        statusText: response.statusText,
        contentType: contentType || undefined,
      });
    }
  }

  /**
   * Executes one WordPress request and returns payload + response metadata.
   *
   * Throws `WordPressClientError` for:
   * - missing fetch implementation (`CONFIG_ERROR`)
   * - network/timeout failures (`NETWORK_ERROR` / `TIMEOUT_ERROR`)
   * - response parse failures (`PARSE_ERROR`)
   * - non-2xx HTTP responses (`HTTP_ERROR` / `WP_API_ERROR`)
   */
  async request<T = unknown>(options: WordPressRequestOptions): Promise<WordPressRequestResult<T>> {
    const method = options.method ?? 'GET';
    const endpoint = options.endpoint;
    const diagnostics = { method, endpoint, baseUrl: this.baseUrl };

    const url = this.createApiUrl(endpoint, options.params);
    const resolvedAuth = options.auth ?? this.auth;
    const serializedBody = this.serializeBody({
      body: options.body,
      rawBody: options.rawBody,
    });

    const headers = await this.resolveRequestHeaders({
      method,
      url,
      body: serializedBody.body,
      isJsonBody: serializedBody.isJsonBody,
      omitContentType: options.omitContentType,
      auth: resolvedAuth,
      authHeaders: options.authHeaders ?? this.authHeaders,
      cookies: options.cookies ?? this.cookieHeader,
      headers: options.headers,
    });

    const credentials = resolveWordPressRequestCredentials({
      auth: resolvedAuth,
      credentials: options.credentials ?? this.requestCredentials,
    });

    const requestInit: RequestInit = {
      method,
      headers,
      body: serializedBody.body,
      credentials,
    };

    if (typeof this.fetcher !== 'function' && typeof globalThis.fetch !== 'function') {
      throw createConfigError(
        'No fetch implementation found. Provide a custom `fetch` via WordPressClientConfig or ensure `globalThis.fetch` is available.',
        diagnostics,
      );
    }

    // Invoke rate limiter / custom callback before making the request
    if (this.onRequest) {
      await this.onRequest(url.toString(), requestInit);
    }

    let response: Response;

    try {
      response = typeof this.fetcher === 'function'
        ? await this.fetcher(url.toString(), requestInit)
        : await globalThis.fetch(url.toString(), requestInit);
    } catch (error) {
      throw classifyFetchError(error, diagnostics);
    }

    const data = await this.parseResponseBody(response, diagnostics) as T;

    // Throw on non-2xx so callers always receive successful data
    throwIfHttpError(response, data, diagnostics);

    return {
      data,
      response,
    };
  }

  /**
   * Fetches typed data from one WordPress REST endpoint.
   */
  async fetchAPI<T>(
    endpoint: string,
    params: Record<string, string | string[]> = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<T> {
    const result = await this.fetchAPIPaginated<T>(endpoint, params, requestOptions);
    return result.data;
  }

  /**
   * Fetches typed data and pagination metadata from one REST endpoint.
   */
  async fetchAPIPaginated<T>(
    endpoint: string,
    params: Record<string, string | string[]> = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<FetchResult<T>> {
    const { data, response } = await this.request<T>(applyRequestOverrides({
      endpoint,
      method: 'GET',
      params,
    }, requestOptions));

    const total = Number.parseInt(response.headers.get('X-WP-Total') || '0', 10);
    const totalPages = Number.parseInt(response.headers.get('X-WP-TotalPages') || '0', 10);

    return { data, total, totalPages };
  }

  /**
   * Performs username/password JWT login against the WP JWT plugin endpoint.
   */
  async loginWithJwt<TJwtResponse = JwtAuthTokenResponse>(
    credentials: JwtLoginCredentials,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TJwtResponse> {
    const { data } = await this.request<unknown>(applyRequestOverrides({
      endpoint: '/wp-json/jwt-auth/v1/token',
      method: 'POST',
      body: credentials,
    }, requestOptions));

    return data as TJwtResponse;
  }

  /**
   * Validates one JWT token with the WP JWT plugin endpoint.
   */
  async validateJwtToken<TJwtValidation = JwtAuthValidationResponse>(
    token?: string | JwtAuthCredentials,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TJwtValidation> {
    const authHeader = token
      ? createJwtAuthHeader(typeof token === 'string' ? token : token.token)
      : undefined;

    const { data } = await this.request<unknown>(applyRequestOverrides({
      endpoint: '/wp-json/jwt-auth/v1/token/validate',
      method: 'POST',
      auth: authHeader,
    }, requestOptions));

    return data as TJwtValidation;
  }
}

/**
 * Minimal interface that resource classes receive.
 * Intentionally excludes transport-level concerns (URL construction, JWT helpers,
 * header mutation) so resources only depend on what they actually use.
 */
export interface WordPressRuntime {
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  fetchAPI: <T>(endpoint: string, params?: Record<string, string | string[]>, options?: WordPressRequestOverrides) => Promise<T>;
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string | string[]>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>;
  hasAuth: () => boolean;
}

/**
 * Creates a runtime interface from a transport instance.
 */
export function createRuntime(transport: WordPressTransport): WordPressRuntime {
  return {
    request: transport.request.bind(transport),
    fetchAPI: transport.fetchAPI.bind(transport),
    fetchAPIPaginated: transport.fetchAPIPaginated.bind(transport),
    hasAuth: transport.hasAuth.bind(transport),
  };
}
