import { createJwtAuthHeader, resolveWordPressRequestCredentials, resolveWordPressRequestHeaders, } from './auth.js';
import { WordPressAbilityBuilder, createAbilityMethods, } from './abilities.js';
import { createPostsMethods } from './posts.js';
import { createPagesMethods } from './pages.js';
import { createMediaMethods } from './media.js';
import { createCategoriesMethods } from './categories.js';
import { createTagsMethods } from './tags.js';
import { createUsersMethods } from './users.js';
import { createSettingsMethods } from './settings.js';
import { createCommentsMethods } from './comments.js';
import { createContentTermMethods } from './client-content-terms.js';
import { throwIfWordPressError } from './errors.js';
import { authorSchema, categorySchema, commentSchema, mediaSchema, pageSchema, postSchema, settingsSchema, } from './schemas.js';
import { PostRelationQueryBuilder, } from './relations.js';
import { WordPressRequestBuilder } from './wpapi-request.js';
import { validateWithStandardSchema, } from './validation.js';
import { compactPayload, } from './types.js';
/**
 * Runtime-agnostic WordPress API client with typed resources and CRUD helpers.
 */
export class WordPressClient {
    baseUrl;
    baseOrigin;
    apiBase;
    auth;
    authHeaders;
    cookieHeader;
    defaultHeaders;
    requestCredentials;
    fetcher;
    // Posts methods
    getPosts;
    getAllPosts;
    getPostsPaginated;
    getPost;
    getPostBySlug;
    // Pages methods
    getPages;
    getAllPages;
    getPagesPaginated;
    getPage;
    getPageBySlug;
    // Media methods
    getMedia;
    getAllMedia;
    getMediaPaginated;
    getMediaItem;
    getMediaBySlug;
    getImageUrl;
    // Categories methods
    getCategories;
    getAllCategories;
    getCategoriesPaginated;
    getCategory;
    getCategoryBySlug;
    // Tags methods
    getTags;
    getAllTags;
    getTagsPaginated;
    getTag;
    getTagBySlug;
    // Users methods
    getUsers;
    getAllUsers;
    getUsersPaginated;
    getUser;
    getCurrentUser;
    // Settings methods
    getSettings;
    // Comments methods
    getComments;
    getAllComments;
    getCommentsPaginated;
    getComment;
    // Generic content and term methods
    getContentCollection;
    getAllContentCollection;
    getContentCollectionPaginated;
    getContent;
    getContentBySlug;
    createContent;
    updateContent;
    deleteContent;
    getTermCollection;
    getAllTermCollection;
    getTermCollectionPaginated;
    getTerm;
    getTermBySlug;
    createTerm;
    updateTerm;
    deleteTerm;
    content;
    terms;
    // WordPress abilities methods
    getAbilities;
    getAbility;
    getAbilityCategories;
    getAbilityCategory;
    executeGetAbility;
    executeRunAbility;
    executeDeleteAbility;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.baseOrigin = new URL(this.baseUrl).origin;
        this.auth = config.authHeader ? config.authHeader : config.auth;
        this.authHeaders = config.authHeaders;
        this.cookieHeader = config.cookies;
        this.defaultHeaders = {};
        this.requestCredentials = config.credentials;
        this.fetcher = config.fetch ?? fetch;
        this.apiBase = `${this.baseUrl}/wp-json/wp/v2`;
        const fetchAPI = this.fetchAPI.bind(this);
        const fetchAPIPaginated = this.fetchAPIPaginated.bind(this);
        const hasAuth = this.hasAuth.bind(this);
        const request = this.request.bind(this);
        const abilityMethods = createAbilityMethods({
            fetchAPI,
            request,
        });
        this.getAbilities = abilityMethods.getAbilities;
        this.getAbility = abilityMethods.getAbility;
        this.getAbilityCategories = abilityMethods.getAbilityCategories;
        this.getAbilityCategory = abilityMethods.getAbilityCategory;
        this.executeGetAbility = abilityMethods.executeGetAbility;
        this.executeRunAbility = abilityMethods.executeRunAbility;
        this.executeDeleteAbility = abilityMethods.executeDeleteAbility;
        const posts = createPostsMethods(fetchAPI, fetchAPIPaginated);
        this.getPosts = posts.getPosts;
        this.getAllPosts = posts.getAllPosts;
        this.getPostsPaginated = posts.getPostsPaginated;
        this.getPost = posts.getPost;
        this.getPostBySlug = posts.getPostBySlug;
        const pages = createPagesMethods(fetchAPI, fetchAPIPaginated);
        this.getPages = pages.getPages;
        this.getAllPages = pages.getAllPages;
        this.getPagesPaginated = pages.getPagesPaginated;
        this.getPage = pages.getPage;
        this.getPageBySlug = pages.getPageBySlug;
        const media = createMediaMethods(fetchAPI, fetchAPIPaginated);
        this.getMedia = media.getMedia;
        this.getAllMedia = media.getAllMedia;
        this.getMediaPaginated = media.getMediaPaginated;
        this.getMediaItem = media.getMediaItem;
        this.getMediaBySlug = media.getMediaBySlug;
        this.getImageUrl = media.getImageUrl;
        const categories = createCategoriesMethods(fetchAPI, fetchAPIPaginated);
        this.getCategories = categories.getCategories;
        this.getAllCategories = categories.getAllCategories;
        this.getCategoriesPaginated = categories.getCategoriesPaginated;
        this.getCategory = categories.getCategory;
        this.getCategoryBySlug = categories.getCategoryBySlug;
        const tags = createTagsMethods(fetchAPI, fetchAPIPaginated);
        this.getTags = tags.getTags;
        this.getAllTags = tags.getAllTags;
        this.getTagsPaginated = tags.getTagsPaginated;
        this.getTag = tags.getTag;
        this.getTagBySlug = tags.getTagBySlug;
        const users = createUsersMethods(fetchAPI, fetchAPIPaginated, hasAuth);
        this.getUsers = users.getUsers;
        this.getAllUsers = users.getAllUsers;
        this.getUsersPaginated = users.getUsersPaginated;
        this.getUser = users.getUser;
        this.getCurrentUser = users.getCurrentUser;
        const settings = createSettingsMethods(fetchAPI, hasAuth);
        this.getSettings = settings.getSettings;
        const comments = createCommentsMethods(fetchAPI, fetchAPIPaginated);
        this.getComments = comments.getComments;
        this.getAllComments = comments.getAllComments;
        this.getCommentsPaginated = comments.getCommentsPaginated;
        this.getComment = comments.getComment;
        const executeMutation = this.executeMutation.bind(this);
        const contentTerms = createContentTermMethods({
            fetchAPI,
            fetchAPIPaginated,
            request,
            executeMutation,
        });
        this.getContentCollection = contentTerms.getContentCollection;
        this.getAllContentCollection = contentTerms.getAllContentCollection;
        this.getContentCollectionPaginated = contentTerms.getContentCollectionPaginated;
        this.getContent = contentTerms.getContent;
        this.getContentBySlug = contentTerms.getContentBySlug;
        this.createContent = contentTerms.createContent;
        this.updateContent = contentTerms.updateContent;
        this.deleteContent = contentTerms.deleteContent;
        this.getTermCollection = contentTerms.getTermCollection;
        this.getAllTermCollection = contentTerms.getAllTermCollection;
        this.getTermCollectionPaginated = contentTerms.getTermCollectionPaginated;
        this.getTerm = contentTerms.getTerm;
        this.getTermBySlug = contentTerms.getTermBySlug;
        this.createTerm = contentTerms.createTerm;
        this.updateTerm = contentTerms.updateTerm;
        this.deleteTerm = contentTerms.deleteTerm;
        this.content = contentTerms.content;
        this.terms = contentTerms.terms;
    }
    /**
     * Rejects absolute URLs that do not target the configured WordPress origin.
     */
    createAbsoluteApiUrl(endpoint) {
        const url = new URL(endpoint);
        if (url.origin !== this.baseOrigin) {
            throw new Error(`Cross-origin absolute URLs are not allowed. Expected origin '${this.baseOrigin}' but received '${url.origin}'.`);
        }
        return url;
    }
    /**
     * Builds one REST URL from endpoint and query params.
     */
    createApiUrl(endpoint, params = {}) {
        const url = /^https?:\/\//i.test(endpoint)
            ? this.createAbsoluteApiUrl(endpoint)
            : endpoint.startsWith('/wp-json/')
                ? new URL(`${this.baseUrl}${endpoint}`)
                : new URL(`${this.apiBase}${endpoint}`);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }
        return url;
    }
    /**
     * Resolves one endpoint and params pair into an absolute URL string.
     */
    createApiUrlString(endpoint, params = {}) {
        return this.createApiUrl(endpoint, params).toString();
    }
    /**
     * Normalizes a namespace + resource pair to one request endpoint.
     */
    createNamespacedEndpoint(resource, namespace = 'wp/v2') {
        const normalizedNamespace = namespace.replace(/^\/+|\/+$/g, '');
        const normalizedResource = resource.replace(/^\/+|\/+$/g, '');
        if (!normalizedResource) {
            throw new Error('Resource path must not be empty.');
        }
        if (normalizedNamespace === 'wp/v2') {
            return `/${normalizedResource}`;
        }
        return `/wp-json/${normalizedNamespace}/${normalizedResource}`;
    }
    /**
     * Serializes request body input to one final body value.
     */
    serializeBody(options) {
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
     * Checks whether one header name exists in a header map.
     */
    hasHeader(headers, headerName) {
        const expected = headerName.toLowerCase();
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === expected) {
                return true;
            }
        }
        return false;
    }
    /**
     * Resolves final request headers from auth, cookies, and caller-provided headers.
     */
    async resolveRequestHeaders(config) {
        const headers = {};
        Object.assign(headers, await resolveWordPressRequestHeaders({
            auth: config.auth,
            authHeaders: config.authHeaders,
            request: {
                method: config.method,
                url: config.url,
                body: config.body,
            },
        }));
        if (config.cookies) {
            headers.Cookie = config.cookies;
        }
        Object.assign(headers, this.defaultHeaders);
        if (config.headers) {
            Object.assign(headers, config.headers);
        }
        if (config.isJsonBody
            && !config.omitContentType
            && !this.hasHeader(headers, 'Content-Type')) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }
    /**
     * Parses one REST response payload based on returned content type.
     */
    async parseResponseBody(response) {
        const contentType = response.headers.get('Content-Type')?.toLowerCase() || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    }
    /**
     * Returns whether authentication is configured on this client instance.
     */
    hasAuth() {
        return this.auth !== undefined || this.authHeaders !== undefined || this.cookieHeader !== undefined;
    }
    setHeaders(nameOrHeaders, value) {
        if (typeof nameOrHeaders === 'string') {
            this.defaultHeaders[nameOrHeaders] = value ?? '';
            return this;
        }
        Object.assign(this.defaultHeaders, nameOrHeaders);
        return this;
    }
    /**
     * Executes one low-level WordPress request and returns payload + response metadata.
     */
    async request(options) {
        const method = options.method ?? 'GET';
        const url = this.createApiUrl(options.endpoint, options.params);
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
        const response = await this.fetcher(url.toString(), {
            method,
            headers,
            body: serializedBody.body,
            credentials,
        });
        const data = await this.parseResponseBody(response);
        return {
            data,
            response,
        };
    }
    /**
     * Fetches typed data from one WordPress REST endpoint.
     */
    async fetchAPI(endpoint, params = {}) {
        const result = await this.fetchAPIPaginated(endpoint, params);
        return result.data;
    }
    /**
     * Fetches typed data and pagination metadata from one REST endpoint.
     */
    async fetchAPIPaginated(endpoint, params = {}) {
        const { data, response } = await this.request({
            endpoint,
            method: 'GET',
            params,
        });
        throwIfWordPressError(response, data);
        const total = Number.parseInt(response.headers.get('X-WP-Total') || '0', 10);
        const totalPages = Number.parseInt(response.headers.get('X-WP-TotalPages') || '0', 10);
        return { data, total, totalPages };
    }
    /**
     * Executes one mutation request and optionally parses response data with a schema.
     */
    async executeMutation(options, responseSchema) {
        const { data, response } = await this.request(options);
        throwIfWordPressError(response, data);
        if (responseSchema) {
            return validateWithStandardSchema(responseSchema, data, 'WordPress mutation response validation failed');
        }
        return data;
    }
    /**
     * Creates one post with typed schema parsing.
     */
    async createPost(input, responseSchema) {
        return this.createContent('posts', input, responseSchema ?? postSchema);
    }
    /**
     * Updates one post with typed schema parsing.
     */
    async updatePost(id, input, responseSchema) {
        return this.updateContent('posts', id, input, responseSchema ?? postSchema);
    }
    /**
     * Deletes one post.
     */
    async deletePost(id, options = {}) {
        return this.deleteContent('posts', id, options);
    }
    /**
     * Creates one page with typed schema parsing.
     */
    async createPage(input, responseSchema) {
        return this.createContent('pages', input, responseSchema ?? pageSchema);
    }
    /**
     * Updates one page with typed schema parsing.
     */
    async updatePage(id, input, responseSchema) {
        return this.updateContent('pages', id, input, responseSchema ?? pageSchema);
    }
    /**
     * Deletes one page.
     */
    async deletePage(id, options = {}) {
        return this.deleteContent('pages', id, options);
    }
    /**
     * Creates one category with typed schema parsing.
     */
    async createCategory(input, responseSchema) {
        return this.createTerm('categories', input, responseSchema ?? categorySchema);
    }
    /**
     * Updates one category with typed schema parsing.
     */
    async updateCategory(id, input, responseSchema) {
        return this.updateTerm('categories', id, input, responseSchema ?? categorySchema);
    }
    /**
     * Deletes one category.
     */
    async deleteCategory(id, options = {}) {
        return this.deleteTerm('categories', id, options);
    }
    /**
     * Creates one tag with typed schema parsing.
     */
    async createTag(input, responseSchema) {
        return this.createTerm('tags', input, responseSchema ?? categorySchema);
    }
    /**
     * Updates one tag with typed schema parsing.
     */
    async updateTag(id, input, responseSchema) {
        return this.updateTerm('tags', id, input, responseSchema ?? categorySchema);
    }
    /**
     * Deletes one tag.
     */
    async deleteTag(id, options = {}) {
        return this.deleteTerm('tags', id, options);
    }
    /**
     * Creates one user.
     */
    async createUser(input, responseSchema) {
        return this.executeMutation({
            endpoint: '/users',
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema ?? authorSchema);
    }
    /**
     * Updates one user.
     */
    async updateUser(id, input, responseSchema) {
        return this.executeMutation({
            endpoint: `/users/${id}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema ?? authorSchema);
    }
    /**
     * Deletes one user.
     */
    async deleteUser(id, options = {}) {
        const params = {
            force: options.force === false ? 'false' : 'true',
        };
        if (typeof options.reassign === 'number') {
            params.reassign = String(options.reassign);
        }
        const { data, response } = await this.request({
            endpoint: `/users/${id}`,
            method: 'DELETE',
            params,
        });
        throwIfWordPressError(response, data);
        if (typeof data === 'object'
            && data !== null
            && 'deleted' in data
            && data.deleted === true) {
            return {
                id,
                deleted: true,
                previous: data.previous,
            };
        }
        return {
            id,
            deleted: false,
        };
    }
    /**
     * Creates one comment.
     */
    async createComment(input, responseSchema) {
        return this.executeMutation({
            endpoint: '/comments',
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema ?? commentSchema);
    }
    /**
     * Updates one comment.
     */
    async updateComment(id, input, responseSchema) {
        return this.executeMutation({
            endpoint: `/comments/${id}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema ?? commentSchema);
    }
    /**
     * Deletes one comment.
     */
    async deleteComment(id, options = {}) {
        const params = options.force ? { force: 'true' } : undefined;
        const { data, response } = await this.request({
            endpoint: `/comments/${id}`,
            method: 'DELETE',
            params,
        });
        throwIfWordPressError(response, data);
        if (typeof data === 'object'
            && data !== null
            && 'deleted' in data
            && data.deleted === true) {
            return {
                id,
                deleted: true,
                previous: data.previous,
            };
        }
        return {
            id,
            deleted: false,
        };
    }
    /**
     * Creates one media record from a JSON payload.
     */
    async createMedia(input, responseSchema) {
        return this.executeMutation({
            endpoint: '/media',
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema ?? mediaSchema);
    }
    /**
     * Uploads one binary media file and optionally applies metadata.
     */
    async uploadMedia(input) {
        const fileBody = input.file instanceof Blob
            ? input.file
            : input.file instanceof Uint8Array
                ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
                : input.file instanceof ArrayBuffer
                    ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
                    : input.file;
        const safeFilename = input.filename.replace(/"/g, '');
        const uploadHeaders = {
            'Content-Disposition': `attachment; filename="${safeFilename}"`,
        };
        if (input.mimeType) {
            uploadHeaders['Content-Type'] = input.mimeType;
        }
        const created = await this.executeMutation({
            endpoint: '/media',
            method: 'POST',
            rawBody: fileBody,
            headers: uploadHeaders,
            omitContentType: true,
        }, mediaSchema);
        const metadata = {};
        if (input.title) {
            metadata.title = input.title;
        }
        if (input.caption) {
            metadata.caption = input.caption;
        }
        if (input.description) {
            metadata.description = input.description;
        }
        if (input.alt_text) {
            metadata.alt_text = input.alt_text;
        }
        if (input.status) {
            metadata.status = input.status;
        }
        if (Object.keys(metadata).length === 0) {
            return created;
        }
        return this.updateMedia(created.id, metadata);
    }
    /**
     * Updates one media record.
     */
    async updateMedia(id, input, responseSchema) {
        return this.executeMutation({
            endpoint: `/media/${id}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema ?? mediaSchema);
    }
    /**
     * Deletes one media record.
     */
    async deleteMedia(id, options = {}) {
        const params = options.force ? { force: 'true' } : undefined;
        const { data, response } = await this.request({
            endpoint: `/media/${id}`,
            method: 'DELETE',
            params,
        });
        throwIfWordPressError(response, data);
        if (typeof data === 'object'
            && data !== null
            && 'deleted' in data
            && data.deleted === true) {
            return {
                id,
                deleted: true,
                previous: data.previous,
            };
        }
        return {
            id,
            deleted: false,
        };
    }
    /**
     * Updates WordPress site settings.
     */
    async updateSettings(input) {
        if (!this.hasAuth()) {
            throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
        }
        return this.executeMutation({
            endpoint: '/settings',
            method: 'POST',
            body: compactPayload(input),
        }, settingsSchema);
    }
    /**
     * Performs username/password JWT login against the WP JWT plugin endpoint.
     */
    async loginWithJwt(credentials) {
        return this.executeMutation({
            endpoint: '/wp-json/jwt-auth/v1/token',
            method: 'POST',
            body: credentials,
        });
    }
    /**
     * Validates one JWT token with the WP JWT plugin endpoint.
     */
    async validateJwtToken(token) {
        const authHeader = token
            ? createJwtAuthHeader(typeof token === 'string' ? token : token.token)
            : undefined;
        return this.executeMutation({
            endpoint: '/wp-json/jwt-auth/v1/token/validate',
            method: 'POST',
            auth: authHeader,
        });
    }
    /**
     * Starts one fluent REST ability builder with optional input/output validation.
     */
    ability(name) {
        return new WordPressAbilityBuilder({
            fetchAPI: this.fetchAPI.bind(this),
            request: this.request.bind(this),
        }, name);
    }
    /**
     * Creates one WPAPI-style request builder for any REST namespace/resource pair.
     */
    route(resource, namespace = 'wp/v2') {
        const endpoint = this.createNamespacedEndpoint(resource, namespace);
        return new WordPressRequestBuilder({
            request: this.request.bind(this),
            createUrl: this.createApiUrlString.bind(this),
        }, endpoint);
    }
    /**
     * Returns one namespace-scoped request factory for custom/plugin routes.
     */
    namespace(namespace) {
        const route = (resource) => this.route(resource, namespace);
        return {
            route,
            resource: route,
        };
    }
    /**
     * Registers one route factory following node-wpapi style route declarations.
     */
    registerRoute(namespace, route) {
        const normalizedRoute = route
            .replace(/\/\(\?P<[^>]+>[^)]+\)/g, '')
            .replace(/\/\(\?P<[^>]+>\)/g, '')
            .replace(/^\/+|\/+$/g, '');
        return () => this.route(normalizedRoute, namespace);
    }
    /**
     * Starts one WPAPI-style posts request chain.
     */
    posts() {
        return this.route('posts');
    }
    /**
     * Starts one WPAPI-style pages request chain.
     */
    pages() {
        return this.route('pages');
    }
    /**
     * Starts one WPAPI-style media request chain.
     */
    media() {
        return this.route('media');
    }
    /**
     * Starts one WPAPI-style categories request chain.
     */
    categories() {
        return this.route('categories');
    }
    /**
     * Starts one WPAPI-style tags request chain.
     */
    tags() {
        return this.route('tags');
    }
    /**
     * Starts one WPAPI-style users request chain.
     */
    users() {
        return this.route('users');
    }
    /**
     * Starts one WPAPI-style comments request chain.
     */
    comments() {
        return this.route('comments');
    }
    /**
     * Starts one WPAPI-style settings request chain.
     */
    settings() {
        return this.route('settings');
    }
    /**
     * Starts one WPAPI-style post types request chain.
     */
    types() {
        return this.route('types');
    }
    /**
     * Starts one WPAPI-style taxonomies request chain.
     */
    taxonomies() {
        return this.route('taxonomies');
    }
    /**
     * Starts one WPAPI-style statuses request chain.
     */
    statuses() {
        return this.route('statuses');
    }
    /**
     * Starts one WPAPI-style search request chain.
     */
    search() {
        return this.route('search');
    }
    /**
     * Starts one WPAPI-style block request chain.
     */
    blocks() {
        return this.route('blocks');
    }
    /**
     * Starts one fluent post relation query by ID or slug.
     */
    post(idOrSlug) {
        if (typeof idOrSlug === 'number') {
            return new PostRelationQueryBuilder(this, { id: idOrSlug });
        }
        return new PostRelationQueryBuilder(this, { slug: idOrSlug });
    }
    /**
     * Fetches one post and resolves selected related entities in one call.
     */
    async getPostWithRelations(idOrSlug, ...relations) {
        const query = this.post(idOrSlug).with(...relations);
        return query.get();
    }
}
