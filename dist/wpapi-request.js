import { throwIfWordPressError } from './errors.js';
/**
 * Converts one query value into a string accepted by the REST API.
 */
function stringifyParamValue(value) {
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
export class WordPressRequestBuilder {
    runtime;
    baseEndpoint;
    queryParams = {};
    requestHeaders = {};
    resourceId;
    includeEmbed = false;
    requestAuth;
    requestAuthHeaders;
    requestCookies;
    requestCredentials;
    constructor(runtime, baseEndpoint) {
        this.runtime = runtime;
        this.baseEndpoint = baseEndpoint;
    }
    /**
     * Sets one resource ID path segment.
     */
    id(value) {
        this.resourceId = value;
        return this;
    }
    /**
     * Adds one arbitrary query parameter.
     */
    param(name, value) {
        this.queryParams[name] = stringifyParamValue(value);
        return this;
    }
    /**
     * Adds many query parameters in one call.
     */
    params(values) {
        for (const [name, value] of Object.entries(values)) {
            this.param(name, value);
        }
        return this;
    }
    /**
     * Sets `slug` query filtering.
     */
    slug(value) {
        return this.param('slug', value);
    }
    /**
     * Sets full page selection for paginated results.
     */
    page(value) {
        return this.param('page', value);
    }
    /**
     * Sets `per_page` query filtering.
     */
    perPage(value) {
        return this.param('per_page', value);
    }
    /**
     * Sets `offset` query filtering.
     */
    offset(value) {
        return this.param('offset', value);
    }
    /**
     * Sets `search` query filtering.
     */
    search(value) {
        return this.param('search', value);
    }
    /**
     * Sets `status` query filtering.
     */
    status(value) {
        return this.param('status', value);
    }
    /**
     * Sets `author` query filtering.
     */
    author(value) {
        return this.param('author', value);
    }
    /**
     * Sets `categories` query filtering.
     */
    categories(value) {
        return this.param('categories', value);
    }
    /**
     * Sets `tags` query filtering.
     */
    tags(value) {
        return this.param('tags', value);
    }
    /**
     * Sets `include` query filtering.
     */
    include(value) {
        return this.param('include', value);
    }
    /**
     * Sets `exclude` query filtering.
     */
    exclude(value) {
        return this.param('exclude', value);
    }
    /**
     * Sets `order` query filtering.
     */
    order(value) {
        return this.param('order', value);
    }
    /**
     * Sets `orderby` query filtering.
     */
    orderby(value) {
        return this.param('orderby', value);
    }
    /**
     * Sets `context` query filtering.
     */
    context(value) {
        return this.param('context', value);
    }
    /**
     * Sets `password` query filtering for protected post content.
     */
    password(value) {
        return this.param('password', value);
    }
    /**
     * Enables `_embed` on the current request.
     */
    embed() {
        this.includeEmbed = true;
        return this;
    }
    setHeaders(nameOrHeaders, value) {
        if (typeof nameOrHeaders === 'string') {
            this.requestHeaders[nameOrHeaders] = value ?? '';
            return this;
        }
        Object.assign(this.requestHeaders, nameOrHeaders);
        return this;
    }
    headers(nameOrHeaders, value) {
        if (typeof nameOrHeaders === 'string') {
            return this.setHeaders(nameOrHeaders, value ?? '');
        }
        return this.setHeaders(nameOrHeaders);
    }
    /**
     * Overrides auth for this request chain.
     */
    auth(value) {
        if (!value) {
            return this;
        }
        this.requestAuth = value;
        return this;
    }
    /**
     * Overrides request-aware auth headers for this request chain.
     */
    authHeaders(value) {
        this.requestAuthHeaders = value;
        return this;
    }
    /**
     * Overrides the cookie header for this request chain.
     */
    cookies(value) {
        this.requestCookies = value;
        return this;
    }
    /**
     * Overrides fetch credentials mode for this request chain.
     */
    credentials(value) {
        this.requestCredentials = value;
        return this;
    }
    /**
     * Serializes this chain to the final request URL.
     */
    toString() {
        return this.runtime.createUrl(this.getEndpoint(), this.getParams());
    }
    /**
     * Executes a GET request for the configured resource chain.
     */
    async get() {
        const { data, response } = await this.runtime.request({
            endpoint: this.getEndpoint(),
            method: 'GET',
            params: this.getParams(),
            headers: this.requestHeaders,
            auth: this.requestAuth,
            authHeaders: this.requestAuthHeaders,
            cookies: this.requestCookies,
            credentials: this.requestCredentials,
        });
        throwIfWordPressError(response, data);
        return data;
    }
    /**
     * Executes a POST create request on the configured resource chain.
     */
    async create(payload) {
        const { data, response } = await this.runtime.request({
            endpoint: this.getEndpoint(),
            method: 'POST',
            params: this.getParams(),
            body: payload,
            headers: this.requestHeaders,
            auth: this.requestAuth,
            authHeaders: this.requestAuthHeaders,
            cookies: this.requestCookies,
            credentials: this.requestCredentials,
        });
        throwIfWordPressError(response, data);
        return data;
    }
    /**
     * Executes a POST update request on the configured resource chain.
     */
    async update(payload) {
        const { data, response } = await this.runtime.request({
            endpoint: this.getEndpoint(),
            method: 'POST',
            params: this.getParams(),
            body: payload,
            headers: this.requestHeaders,
            auth: this.requestAuth,
            authHeaders: this.requestAuthHeaders,
            cookies: this.requestCookies,
            credentials: this.requestCredentials,
        });
        throwIfWordPressError(response, data);
        return data;
    }
    /**
     * Executes a DELETE request on the configured resource chain.
     */
    async delete(options = {}) {
        const params = {
            ...this.getParams(),
            ...(options.force === true ? { force: 'true' } : {}),
        };
        const { data, response } = await this.runtime.request({
            endpoint: this.getEndpoint(),
            method: 'DELETE',
            params,
            headers: this.requestHeaders,
            auth: this.requestAuth,
            authHeaders: this.requestAuthHeaders,
            cookies: this.requestCookies,
            credentials: this.requestCredentials,
        });
        throwIfWordPressError(response, data);
        return data;
    }
    /**
     * Makes this builder thenable by resolving to one `.get()` request.
     */
    then(onfulfilled, onrejected) {
        return this.get().then(onfulfilled ?? undefined, onrejected ?? undefined);
    }
    /**
     * Makes this builder catchable by delegating to one `.get()` request.
     */
    catch(onrejected) {
        return this.get().catch(onrejected ?? undefined);
    }
    /**
     * Makes this builder finalizable by delegating to one `.get()` request.
     */
    finally(onfinally) {
        return this.get().finally(onfinally ?? undefined);
    }
    /**
     * Resolves the endpoint path with optional ID segment.
     */
    getEndpoint() {
        if (this.resourceId === undefined) {
            return this.baseEndpoint;
        }
        return `${this.baseEndpoint}/${encodeURIComponent(String(this.resourceId))}`;
    }
    /**
     * Resolves query params with optional `_embed` support.
     */
    getParams() {
        if (!this.includeEmbed) {
            return { ...this.queryParams };
        }
        return {
            ...this.queryParams,
            _embed: 'true',
        };
    }
}
