import { throwIfWordPressError } from '../core/errors.js';
import { assertNoAuthHeaderOverrides } from '../core/request-overrides.js';
import type { WordPressRequestOptions, WordPressRequestResult } from '../client-types.js';

/**
 * Runtime hooks used by the WPAPI-style request builder.
 */
export interface WordPressRequestBuilderRuntime {
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  createUrl: (endpoint: string, params?: Record<string, string | string[]>) => string;
}

/**
 * Supported options for `.delete()` in the WPAPI-style request chain.
 */
export interface WordPressRequestDeleteOptions {
  force?: boolean;
}

/**
 * Converts one query value into a string accepted by the REST API.
 */
function stringifyParamValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stringifyParamValue(entry)).join(',');
  }

  return String(value);
}

/**
 * Fluent, WPAPI-inspired request builder for one REST resource.
 */
export class WordPressRequestBuilder<
  TResponse = unknown,
  TCreateInput extends Record<string, unknown> = Record<string, unknown>,
  TUpdateInput extends Record<string, unknown> = TCreateInput,
> implements PromiseLike<TResponse> {
  private readonly queryParams: Record<string, string | string[]> = {};
  private readonly requestHeaders: Record<string, string> = {};
  private resourceId: number | string | undefined;
  private includeEmbed = false;

  constructor(
    private readonly runtime: WordPressRequestBuilderRuntime,
    private readonly baseEndpoint: string,
  ) {}

  /**
   * Sets one resource ID path segment.
   */
  id(value: number | string): this {
    this.resourceId = value;
    return this;
  }

  /**
   * Adds one arbitrary query parameter.
   *
   * When `value` is an array each element is stringified and the parameter is
   * encoded using WordPress bracket notation (`key[]=a&key[]=b`), which is
   * required for multi-value REST params such as `subtype` on the search
   * endpoint.  Single values are encoded as plain strings (`key=value`).
   */
  param(name: string, value: unknown): this {
    if (Array.isArray(value)) {
      this.queryParams[name] = value.map((entry) => stringifyParamValue(entry));
    } else {
      this.queryParams[name] = stringifyParamValue(value);
    }

    return this;
  }

  /**
   * Adds many query parameters in one call.
   */
  params(values: Record<string, unknown>): this {
    for (const [name, value] of Object.entries(values)) {
      this.param(name, value);
    }

    return this;
  }

  /**
   * Sets `slug` query filtering.
   */
  slug(value: string): this {
    return this.param('slug', value);
  }

  /**
   * Sets full page selection for paginated results.
   */
  page(value: number): this {
    return this.param('page', value);
  }

  /**
   * Sets `per_page` query filtering.
   */
  perPage(value: number): this {
    return this.param('per_page', value);
  }

  /**
   * Sets `offset` query filtering.
   */
  offset(value: number): this {
    return this.param('offset', value);
  }

  /**
   * Sets `search` query filtering.
   */
  search(value: string): this {
    return this.param('search', value);
  }

  /**
   * Sets `status` query filtering.
   */
  status(value: string | string[]): this {
    return this.param('status', value);
  }

  /**
   * Sets `author` query filtering.
   */
  author(value: number): this {
    return this.param('author', value);
  }

  /**
   * Sets `categories` query filtering.
   */
  categories(value: number[]): this {
    return this.param('categories', value);
  }

  /**
   * Sets `tags` query filtering.
   */
  tags(value: number[]): this {
    return this.param('tags', value);
  }

  /**
   * Sets `include` query filtering.
   */
  include(value: number[]): this {
    return this.param('include', value);
  }

  /**
   * Sets `exclude` query filtering.
   */
  exclude(value: number[]): this {
    return this.param('exclude', value);
  }

  /**
   * Sets `order` query filtering.
   */
  order(value: 'asc' | 'desc'): this {
    return this.param('order', value);
  }

  /**
   * Sets `orderby` query filtering.
   */
  orderby(value: string): this {
    return this.param('orderby', value);
  }

  /**
   * Sets `context` query filtering.
   */
  context(value: 'view' | 'embed' | 'edit' | string): this {
    return this.param('context', value);
  }

  /**
   * Sets `password` query filtering for protected post content.
   */
  password(value: string): this {
    return this.param('password', value);
  }

  /**
   * Enables `_embed` on the current request.
   */
  embed(): this {
    this.includeEmbed = true;
    return this;
  }

  /**
   * Restricts the response to the given subset of fields via `_fields`.
   */
  fields(value: string | string[]): this {
    return this.param('_fields', Array.isArray(value) ? value.join(',') : value);
  }

  /**
   * Sets `subtype` query filtering for the `/wp/v2/search` chain.
   *
   * Accepts a single subtype string or an array of subtypes. Arrays are
   * serialised using WordPress bracket notation so that all values reach the
   * REST endpoint correctly (`subtype[]=post&subtype[]=page`).
   */
  subtype(value: string | string[]): this {
    return this.param('subtype', value);
  }

  /**
   * Adds request headers for this chain only.
   */
  setHeaders(name: string, value: string): this;
  setHeaders(headers: Record<string, string>): this;
  setHeaders(nameOrHeaders: string | Record<string, string>, value?: string): this {
    if (typeof nameOrHeaders === 'string') {
      assertNoAuthHeaderOverrides({ [nameOrHeaders]: value ?? '' }, 'WPAPI chain options');
      this.requestHeaders[nameOrHeaders] = value ?? '';
      return this;
    }

    assertNoAuthHeaderOverrides(nameOrHeaders, 'WPAPI chain options');

    Object.assign(this.requestHeaders, nameOrHeaders);
    return this;
  }

  /**
   * Alias for `setHeaders` to align with common chaining vocabulary.
   */
  headers(name: string, value: string): this;
  headers(headers: Record<string, string>): this;
  headers(nameOrHeaders: string | Record<string, string>, value?: string): this {
    if (typeof nameOrHeaders === 'string') {
      return this.setHeaders(nameOrHeaders, value ?? '');
    }

    return this.setHeaders(nameOrHeaders);
  }

  /**
   * Serializes this chain to the final request URL.
   */
  toString(): string {
    return this.runtime.createUrl(this.getEndpoint(), this.getParams());
  }

  /**
   * Executes a GET request for the configured resource chain.
   */
  async get(): Promise<TResponse> {
    const { data, response } = await this.runtime.request<TResponse>({
      endpoint: this.getEndpoint(),
      method: 'GET',
      params: this.getParams(),
      headers: this.requestHeaders,
    });

    throwIfWordPressError(response, data);
    return data;
  }

  /**
   * Executes a POST create request on the configured resource chain.
   */
  async create(payload: TCreateInput): Promise<TResponse> {
    const { data, response } = await this.runtime.request<TResponse>({
      endpoint: this.getEndpoint(),
      method: 'POST',
      params: this.getParams(),
      body: payload,
      headers: this.requestHeaders,
    });

    throwIfWordPressError(response, data);
    return data;
  }

  /**
   * Executes a POST update request on the configured resource chain.
   */
  async update(payload: TUpdateInput): Promise<TResponse> {
    const { data, response } = await this.runtime.request<TResponse>({
      endpoint: this.getEndpoint(),
      method: 'POST',
      params: this.getParams(),
      body: payload,
      headers: this.requestHeaders,
    });

    throwIfWordPressError(response, data);
    return data;
  }

  /**
   * Executes a DELETE request on the configured resource chain.
   */
  async delete(options: WordPressRequestDeleteOptions = {}): Promise<TResponse> {
    const params = {
      ...this.getParams(),
      ...(options.force === true ? { force: 'true' } : {}),
    };

    const { data, response } = await this.runtime.request<TResponse>({
      endpoint: this.getEndpoint(),
      method: 'DELETE',
      params,
      headers: this.requestHeaders,
    });

    throwIfWordPressError(response, data);
    return data;
  }

  /**
   * Makes this builder thenable by resolving to one `.get()` request.
   */
  then<TResult1 = TResponse, TResult2 = never>(
    onfulfilled?: ((value: TResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.get().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  /**
   * Makes this builder catchable by delegating to one `.get()` request.
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TResponse | TResult> {
    return this.get().catch(onrejected ?? undefined);
  }

  /**
   * Makes this builder finalizable by delegating to one `.get()` request.
   */
  finally(onfinally?: (() => void) | null): Promise<TResponse> {
    return this.get().finally(onfinally ?? undefined);
  }

  /**
   * Resolves the endpoint path with optional ID segment.
   */
  private getEndpoint(): string {
    if (this.resourceId === undefined) {
      return this.baseEndpoint;
    }

    return `${this.baseEndpoint}/${encodeURIComponent(String(this.resourceId))}`;
  }

  /**
   * Resolves query params with optional `_embed` support.
   */
  private getParams(): Record<string, string | string[]> {
    if (!this.includeEmbed) {
      return { ...this.queryParams };
    }

    return {
      ...this.queryParams,
      _embed: 'true',
    };
  }
}
