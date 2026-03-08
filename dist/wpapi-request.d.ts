import { type WordPressAuthHeaders, type WordPressAuthHeadersProvider, type WordPressAuthInput } from './auth.js';
import type { WordPressRequestOptions, WordPressRequestResult } from './client-types.js';
/**
 * Runtime hooks used by the WPAPI-style request builder.
 */
export interface WordPressRequestBuilderRuntime {
    request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
    createUrl: (endpoint: string, params?: Record<string, string>) => string;
}
/**
 * Supported options for `.delete()` in the WPAPI-style request chain.
 */
export interface WordPressRequestDeleteOptions {
    force?: boolean;
}
/**
 * Fluent, WPAPI-inspired request builder for one REST resource.
 */
export declare class WordPressRequestBuilder<TResponse = unknown, TCreateInput extends Record<string, unknown> = Record<string, unknown>, TUpdateInput extends Record<string, unknown> = TCreateInput> implements PromiseLike<TResponse> {
    private readonly runtime;
    private readonly baseEndpoint;
    private readonly queryParams;
    private readonly requestHeaders;
    private resourceId;
    private includeEmbed;
    private requestAuth;
    private requestAuthHeaders;
    private requestCookies;
    private requestCredentials;
    constructor(runtime: WordPressRequestBuilderRuntime, baseEndpoint: string);
    /**
     * Sets one resource ID path segment.
     */
    id(value: number | string): this;
    /**
     * Adds one arbitrary query parameter.
     */
    param(name: string, value: unknown): this;
    /**
     * Adds many query parameters in one call.
     */
    params(values: Record<string, unknown>): this;
    /**
     * Sets `slug` query filtering.
     */
    slug(value: string): this;
    /**
     * Sets full page selection for paginated results.
     */
    page(value: number): this;
    /**
     * Sets `per_page` query filtering.
     */
    perPage(value: number): this;
    /**
     * Sets `offset` query filtering.
     */
    offset(value: number): this;
    /**
     * Sets `search` query filtering.
     */
    search(value: string): this;
    /**
     * Sets `status` query filtering.
     */
    status(value: string | string[]): this;
    /**
     * Sets `author` query filtering.
     */
    author(value: number): this;
    /**
     * Sets `categories` query filtering.
     */
    categories(value: number | number[]): this;
    /**
     * Sets `tags` query filtering.
     */
    tags(value: number | number[]): this;
    /**
     * Sets `include` query filtering.
     */
    include(value: number | number[]): this;
    /**
     * Sets `exclude` query filtering.
     */
    exclude(value: number | number[]): this;
    /**
     * Sets `order` query filtering.
     */
    order(value: 'asc' | 'desc'): this;
    /**
     * Sets `orderby` query filtering.
     */
    orderby(value: string): this;
    /**
     * Sets `context` query filtering.
     */
    context(value: 'view' | 'embed' | 'edit' | string): this;
    /**
     * Sets `password` query filtering for protected post content.
     */
    password(value: string): this;
    /**
     * Enables `_embed` on the current request.
     */
    embed(): this;
    /**
     * Adds request headers for this chain only.
     */
    setHeaders(name: string, value: string): this;
    setHeaders(headers: Record<string, string>): this;
    /**
     * Alias for `setHeaders` to align with common chaining vocabulary.
     */
    headers(name: string, value: string): this;
    headers(headers: Record<string, string>): this;
    /**
     * Overrides auth for this request chain.
     */
    auth(value?: WordPressAuthInput): this;
    /**
     * Overrides request-aware auth headers for this request chain.
     */
    authHeaders(value: WordPressAuthHeaders | WordPressAuthHeadersProvider): this;
    /**
     * Overrides the cookie header for this request chain.
     */
    cookies(value: string): this;
    /**
     * Overrides fetch credentials mode for this request chain.
     */
    credentials(value: RequestCredentials): this;
    /**
     * Serializes this chain to the final request URL.
     */
    toString(): string;
    /**
     * Executes a GET request for the configured resource chain.
     */
    get(): Promise<TResponse>;
    /**
     * Executes a POST create request on the configured resource chain.
     */
    create(payload: TCreateInput): Promise<TResponse>;
    /**
     * Executes a POST update request on the configured resource chain.
     */
    update(payload: TUpdateInput): Promise<TResponse>;
    /**
     * Executes a DELETE request on the configured resource chain.
     */
    delete(options?: WordPressRequestDeleteOptions): Promise<TResponse>;
    /**
     * Makes this builder thenable by resolving to one `.get()` request.
     */
    then<TResult1 = TResponse, TResult2 = never>(onfulfilled?: ((value: TResponse) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    /**
     * Makes this builder catchable by delegating to one `.get()` request.
     */
    catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<TResponse | TResult>;
    /**
     * Makes this builder finalizable by delegating to one `.get()` request.
     */
    finally(onfinally?: (() => void) | null): Promise<TResponse>;
    /**
     * Resolves the endpoint path with optional ID segment.
     */
    private getEndpoint;
    /**
     * Resolves query params with optional `_embed` support.
     */
    private getParams;
}
