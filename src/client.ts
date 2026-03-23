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
} from './auth.js';
import {
  WordPressAbilityBuilder,
  createAbilityMethods,
} from './abilities.js';
import type {
  WordPressClientConfig,
  WordPressMediaUploadInput,
  WordPressRequestOptions,
  WordPressRequestOverrides,
  WordPressRequestResult,
} from './client-types.js';
import { createPostsMethods } from './resources/posts.js';
import { createPagesMethods } from './resources/pages.js';
import { createMediaMethods } from './resources/media.js';
import { createCategoriesMethods } from './resources/categories.js';
import { createTagsMethods } from './resources/tags.js';
import { createUsersMethods } from './resources/users.js';
import { createSettingsMethods } from './resources/settings.js';
import { createCommentsMethods } from './resources/comments.js';
import { createContentTermMethods } from './resources/content-terms.js';
import { throwIfWordPressError } from './core/errors.js';
import {
  authorSchema,
  categorySchema,
  commentSchema,
  jwtAuthTokenResponseSchema,
  jwtAuthValidationResponseSchema,
  mediaSchema,
  pageSchema,
  postSchema,
  searchResultSchema,
  settingsSchema,
} from './standard-schemas.js';
import {
  type WordPressAuthor,
  type WordPressCategory,
  type WordPressComment,
  type WordPressContent,
  type WordPressMedia,
  type WordPressPage,
  type WordPressPost,
  type WordPressPostWriteBase,
  type WordPressSearchResult,
  type WordPressSettings,
  type WordPressTag,
} from './schemas.js';
import {
  PostRelationQueryBuilder,
  type PostRelation,
  type SelectedPostRelations,
} from './builders/relations.js';
import { WordPressRequestBuilder } from './builders/wpapi-request.js';
import {
  isStandardSchema,
  validateWithStandardSchema,
  type WordPressStandardSchema,
} from './core/validation.js';
import { applyRequestOverrides } from './core/request-overrides.js';
import { compactPayload, filterToParams } from './core/params.js';
import type {
  CategoriesFilter,
  CommentsFilter,
  MediaFilter,
  PagesFilter,
  PostsFilter,
  SearchFilter,
  TagsFilter,
  UsersFilter,
} from './types/filters.js';
import type {
  DeleteOptions,
  TermWriteInput,
  UserDeleteOptions,
  UserWriteInput,
  WordPressWritePayload,
} from './types/payloads.js';
import type {
  ContentResourceClient,
  FetchResult,
  PaginatedResponse,
  TermsResourceClient,
  WordPressDeleteResult,
} from './types/resources.js';

export type {
  WordPressClientConfig,
  WordPressRequestOptions,
  WordPressRequestOverrides,
  WordPressRequestResult,
  WordPressMediaUploadInput,
} from './client-types.js';

/**
 * Namespace-scoped request factory for WPAPI-style route chaining.
 */
export interface WordPressNamespaceClient {
  route: <
    TResponse = unknown,
    TCreate extends Record<string, unknown> = Record<string, unknown>,
    TUpdate extends Record<string, unknown> = TCreate,
  >(
    resource: string,
  ) => WordPressRequestBuilder<TResponse, TCreate, TUpdate>;
  resource: <
    TResponse = unknown,
    TCreate extends Record<string, unknown> = Record<string, unknown>,
    TUpdate extends Record<string, unknown> = TCreate,
  >(
    resource: string,
  ) => WordPressRequestBuilder<TResponse, TCreate, TUpdate>;
}

/**
 * Runtime-agnostic WordPress API client with typed resources and CRUD helpers.
 */
export class WordPressClient {
  private readonly baseUrl: string;
  private readonly baseOrigin: string;
  private readonly apiBase: string;
  private readonly auth: WordPressAuthInput | undefined;
  private readonly authHeaders: WordPressAuthHeaders | WordPressAuthHeadersProvider | undefined;
  private readonly cookieHeader: string | undefined;
  private readonly defaultHeaders: Record<string, string>;
  private readonly requestCredentials: RequestCredentials | undefined;
  private readonly fetcher: typeof fetch | undefined;

  // Posts methods
  public getPosts: ReturnType<typeof createPostsMethods>['getPosts'];
  public getAllPosts: ReturnType<typeof createPostsMethods>['getAllPosts'];
  public getPostsPaginated: ReturnType<typeof createPostsMethods>['getPostsPaginated'];
  public getPost: ReturnType<typeof createPostsMethods>['getPost'];
  public getPostBySlug: ReturnType<typeof createPostsMethods>['getPostBySlug'];

  // Pages methods
  public getPages: ReturnType<typeof createPagesMethods>['getPages'];
  public getAllPages: ReturnType<typeof createPagesMethods>['getAllPages'];
  public getPagesPaginated: ReturnType<typeof createPagesMethods>['getPagesPaginated'];
  public getPage: ReturnType<typeof createPagesMethods>['getPage'];
  public getPageBySlug: ReturnType<typeof createPagesMethods>['getPageBySlug'];

  // Media methods
  public getMedia: ReturnType<typeof createMediaMethods>['getMedia'];
  public getAllMedia: ReturnType<typeof createMediaMethods>['getAllMedia'];
  public getMediaPaginated: ReturnType<typeof createMediaMethods>['getMediaPaginated'];
  public getMediaItem: ReturnType<typeof createMediaMethods>['getMediaItem'];
  public getMediaBySlug: ReturnType<typeof createMediaMethods>['getMediaBySlug'];
  public getImageUrl: ReturnType<typeof createMediaMethods>['getImageUrl'];

  // Categories methods
  public getCategories: ReturnType<typeof createCategoriesMethods>['getCategories'];
  public getAllCategories: ReturnType<typeof createCategoriesMethods>['getAllCategories'];
  public getCategoriesPaginated: ReturnType<typeof createCategoriesMethods>['getCategoriesPaginated'];
  public getCategory: ReturnType<typeof createCategoriesMethods>['getCategory'];
  public getCategoryBySlug: ReturnType<typeof createCategoriesMethods>['getCategoryBySlug'];

  // Tags methods
  public getTags: ReturnType<typeof createTagsMethods>['getTags'];
  public getAllTags: ReturnType<typeof createTagsMethods>['getAllTags'];
  public getTagsPaginated: ReturnType<typeof createTagsMethods>['getTagsPaginated'];
  public getTag: ReturnType<typeof createTagsMethods>['getTag'];
  public getTagBySlug: ReturnType<typeof createTagsMethods>['getTagBySlug'];

  // Users methods
  public getUsers: ReturnType<typeof createUsersMethods>['getUsers'];
  public getAllUsers: ReturnType<typeof createUsersMethods>['getAllUsers'];
  public getUsersPaginated: ReturnType<typeof createUsersMethods>['getUsersPaginated'];
  public getUser: ReturnType<typeof createUsersMethods>['getUser'];
  public getCurrentUser: ReturnType<typeof createUsersMethods>['getCurrentUser'];

  // Settings methods
  public getSettings: ReturnType<typeof createSettingsMethods>['getSettings'];

  // Comments methods
  public getComments: ReturnType<typeof createCommentsMethods>['getComments'];
  public getAllComments: ReturnType<typeof createCommentsMethods>['getAllComments'];
  public getCommentsPaginated: ReturnType<typeof createCommentsMethods>['getCommentsPaginated'];
  public getComment: ReturnType<typeof createCommentsMethods>['getComment'];

  // Generic content and term methods
  public getContentCollection: ReturnType<typeof createContentTermMethods>['getContentCollection'];
  public getAllContentCollection: ReturnType<typeof createContentTermMethods>['getAllContentCollection'];
  public getContentCollectionPaginated: ReturnType<typeof createContentTermMethods>['getContentCollectionPaginated'];
  public getContent: ReturnType<typeof createContentTermMethods>['getContent'];
  public getContentBySlug: ReturnType<typeof createContentTermMethods>['getContentBySlug'];
  public createContent: ReturnType<typeof createContentTermMethods>['createContent'];
  public updateContent: ReturnType<typeof createContentTermMethods>['updateContent'];
  public deleteContent: ReturnType<typeof createContentTermMethods>['deleteContent'];
  public getTermCollection: ReturnType<typeof createContentTermMethods>['getTermCollection'];
  public getAllTermCollection: ReturnType<typeof createContentTermMethods>['getAllTermCollection'];
  public getTermCollectionPaginated: ReturnType<typeof createContentTermMethods>['getTermCollectionPaginated'];
  public getTerm: ReturnType<typeof createContentTermMethods>['getTerm'];
  public getTermBySlug: ReturnType<typeof createContentTermMethods>['getTermBySlug'];
  public createTerm: ReturnType<typeof createContentTermMethods>['createTerm'];
  public updateTerm: ReturnType<typeof createContentTermMethods>['updateTerm'];
  public deleteTerm: ReturnType<typeof createContentTermMethods>['deleteTerm'];
  public content: ReturnType<typeof createContentTermMethods>['content'];
  public terms: ReturnType<typeof createContentTermMethods>['terms'];

  // WordPress abilities methods
  public getAbilities: ReturnType<typeof createAbilityMethods>['getAbilities'];
  public getAbility: ReturnType<typeof createAbilityMethods>['getAbility'];
  public getAbilityCategories: ReturnType<typeof createAbilityMethods>['getAbilityCategories'];
  public getAbilityCategory: ReturnType<typeof createAbilityMethods>['getAbilityCategory'];
  public executeGetAbility: ReturnType<typeof createAbilityMethods>['executeGetAbility'];
  public executeRunAbility: ReturnType<typeof createAbilityMethods>['executeRunAbility'];
  public executeDeleteAbility: ReturnType<typeof createAbilityMethods>['executeDeleteAbility'];

  constructor(config: WordPressClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.baseOrigin = new URL(this.baseUrl).origin;
    this.auth = config.authHeader ? config.authHeader : config.auth;
    this.authHeaders = config.authHeaders;
    this.cookieHeader = config.cookies;
    this.defaultHeaders = {};
    this.requestCredentials = config.credentials;
    this.fetcher = config.fetch;
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

    const posts = createPostsMethods(fetchAPI, fetchAPIPaginated, config.blockParser);
    this.getPosts = posts.getPosts;
    this.getAllPosts = posts.getAllPosts;
    this.getPostsPaginated = posts.getPostsPaginated;
    this.getPost = posts.getPost;
    this.getPostBySlug = posts.getPostBySlug;

    const pages = createPagesMethods(fetchAPI, fetchAPIPaginated, config.blockParser);
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
  private createAbsoluteApiUrl(endpoint: string): URL {
    const url = new URL(endpoint);

    if (url.origin !== this.baseOrigin) {
      throw new Error(
        `Cross-origin absolute URLs are not allowed. Expected origin '${this.baseOrigin}' but received '${url.origin}'.`,
      );
    }

    return url;
  }

  /**
   * Builds one REST URL from endpoint and query params.
   */
  private createApiUrl(endpoint: string, params: Record<string, string | string[]> = {}): URL {
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
  private createApiUrlString(endpoint: string, params: Record<string, string | string[]> = {}): string {
    return this.createApiUrl(endpoint, params).toString();
  }

  /**
   * Normalizes a namespace + resource pair to one request endpoint.
   */
  private createNamespacedEndpoint(resource: string, namespace = 'wp/v2'): string {
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
   */
  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('Content-Type')?.toLowerCase() || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  /**
   * Resolves schema and request options from overloaded mutation helper args.
   */
  private resolveMutationArguments<TResponse>(
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): {
    responseSchema?: WordPressStandardSchema<TResponse>;
    requestOptions?: WordPressRequestOverrides;
  } {
    if (isStandardSchema(responseSchemaOrRequestOptions)) {
      return {
        responseSchema: responseSchemaOrRequestOptions,
        requestOptions,
      };
    }

    if (!responseSchemaOrRequestOptions) {
      return {
        responseSchema: undefined,
        requestOptions,
      };
    }

    return {
      responseSchema: undefined,
      requestOptions: {
        ...responseSchemaOrRequestOptions,
        ...(requestOptions ?? {}),
        headers: {
          ...(responseSchemaOrRequestOptions.headers ?? {}),
          ...(requestOptions?.headers ?? {}),
        },
      },
    };
  }

  /**
   * Returns whether authentication is configured on this client instance.
   */
  hasAuth(): boolean {
    return this.auth !== undefined || this.authHeaders !== undefined || this.cookieHeader !== undefined;
  }

  /**
   * Sets headers used by all subsequent requests from this client instance.
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
   * Executes one low-level WordPress request and returns payload + response metadata.
   */
  async request<T = unknown>(options: WordPressRequestOptions): Promise<WordPressRequestResult<T>> {
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

    const requestInit: RequestInit = {
      method,
      headers,
      body: serializedBody.body,
      credentials,
    };

    if (typeof this.fetcher !== 'function' && typeof globalThis.fetch !== 'function') {
      throw new TypeError(
        'No fetch implementation found. Provide a custom `fetch` via WordPressClientConfig or ensure `globalThis.fetch` is available.',
      );
    }

    const response = typeof this.fetcher === 'function'
      ? await this.fetcher(url.toString(), requestInit)
      : await globalThis.fetch(url.toString(), requestInit);

    const data = await this.parseResponseBody(response) as T;

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
    }, requestOptions, 'Helper request options'));

    throwIfWordPressError(response, data);

    const total = Number.parseInt(response.headers.get('X-WP-Total') || '0', 10);
    const totalPages = Number.parseInt(response.headers.get('X-WP-TotalPages') || '0', 10);

    return { data, total, totalPages };
  }

  /**
   * Executes one mutation request and optionally parses response data with a schema.
   */
  private async executeMutation<T>(
    options: WordPressRequestOptions,
    responseSchema?: WordPressStandardSchema<T>,
  ): Promise<T> {
    const { data, response } = await this.request<unknown>(options);
    throwIfWordPressError(response, data);

    if (responseSchema) {
      return validateWithStandardSchema(
        responseSchema,
        data,
        'WordPress mutation response validation failed',
      );
    }

    return data as T;
  }

  /**
   * Creates one post with typed schema parsing.
   */
  async createPost<TPost = WordPressPost>(
    input: WordPressPostWriteBase & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TPost> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TPost> {
    const resolved = this.resolveMutationArguments<TPost>(responseSchemaOrRequestOptions, requestOptions);

    return this.createContent<TPost, WordPressPostWriteBase & Record<string, unknown>>(
      'posts',
      input,
      resolved.responseSchema ?? (postSchema as WordPressStandardSchema<TPost>),
      resolved.requestOptions,
    );
  }

  /**
   * Updates one post with typed schema parsing.
   */
  async updatePost<TPost = WordPressPost>(
    id: number,
    input: WordPressPostWriteBase & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TPost> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TPost> {
    const resolved = this.resolveMutationArguments<TPost>(responseSchemaOrRequestOptions, requestOptions);

    return this.updateContent<TPost, WordPressPostWriteBase & Record<string, unknown>>(
      'posts',
      id,
      input,
      resolved.responseSchema ?? (postSchema as WordPressStandardSchema<TPost>),
      resolved.requestOptions,
    );
  }

  /**
   * Deletes one post.
   */
  async deletePost(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<WordPressDeleteResult> {
    return this.deleteContent('posts', id, options);
  }

  /**
   * Creates one page with typed schema parsing.
   */
  async createPage<TPage = WordPressPage>(
    input: WordPressPostWriteBase & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TPage> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TPage> {
    const resolved = this.resolveMutationArguments<TPage>(responseSchemaOrRequestOptions, requestOptions);

    return this.createContent<TPage, WordPressPostWriteBase & Record<string, unknown>>(
      'pages',
      input,
      resolved.responseSchema ?? (pageSchema as WordPressStandardSchema<TPage>),
      resolved.requestOptions,
    );
  }

  /**
   * Updates one page with typed schema parsing.
   */
  async updatePage<TPage = WordPressPage>(
    id: number,
    input: WordPressPostWriteBase & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TPage> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TPage> {
    const resolved = this.resolveMutationArguments<TPage>(responseSchemaOrRequestOptions, requestOptions);

    return this.updateContent<TPage, WordPressPostWriteBase & Record<string, unknown>>(
      'pages',
      id,
      input,
      resolved.responseSchema ?? (pageSchema as WordPressStandardSchema<TPage>),
      resolved.requestOptions,
    );
  }

  /**
   * Deletes one page.
   */
  async deletePage(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<WordPressDeleteResult> {
    return this.deleteContent('pages', id, options);
  }

  /**
   * Creates one category with typed schema parsing.
   */
  async createCategory<TCategory = WordPressCategory>(
    input: TermWriteInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TCategory> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TCategory> {
    const resolved = this.resolveMutationArguments<TCategory>(responseSchemaOrRequestOptions, requestOptions);

    return this.createTerm<TCategory, TermWriteInput>(
      'categories',
      input,
      resolved.responseSchema ?? (categorySchema as WordPressStandardSchema<TCategory>),
      resolved.requestOptions,
    );
  }

  /**
   * Updates one category with typed schema parsing.
   */
  async updateCategory<TCategory = WordPressCategory>(
    id: number,
    input: TermWriteInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TCategory> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TCategory> {
    const resolved = this.resolveMutationArguments<TCategory>(responseSchemaOrRequestOptions, requestOptions);

    return this.updateTerm<TCategory, TermWriteInput>(
      'categories',
      id,
      input,
      resolved.responseSchema ?? (categorySchema as WordPressStandardSchema<TCategory>),
      resolved.requestOptions,
    );
  }

  /**
   * Deletes one category.
   */
  async deleteCategory(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<WordPressDeleteResult> {
    return this.deleteTerm('categories', id, options);
  }

  /**
   * Creates one tag with typed schema parsing.
   */
  async createTag<TTag = WordPressTag>(
    input: TermWriteInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TTag> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTag> {
    const resolved = this.resolveMutationArguments<TTag>(responseSchemaOrRequestOptions, requestOptions);

    return this.createTerm<TTag, TermWriteInput>(
      'tags',
      input,
      resolved.responseSchema ?? (categorySchema as WordPressStandardSchema<TTag>),
      resolved.requestOptions,
    );
  }

  /**
   * Updates one tag with typed schema parsing.
   */
  async updateTag<TTag = WordPressTag>(
    id: number,
    input: TermWriteInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TTag> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTag> {
    const resolved = this.resolveMutationArguments<TTag>(responseSchemaOrRequestOptions, requestOptions);

    return this.updateTerm<TTag, TermWriteInput>(
      'tags',
      id,
      input,
      resolved.responseSchema ?? (categorySchema as WordPressStandardSchema<TTag>),
      resolved.requestOptions,
    );
  }

  /**
   * Deletes one tag.
   */
  async deleteTag(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<WordPressDeleteResult> {
    return this.deleteTerm('tags', id, options);
  }

  /**
   * Creates one user.
   */
  async createUser<TUser = WordPressAuthor>(
    input: UserWriteInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TUser> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TUser> {
    const resolved = this.resolveMutationArguments<TUser>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TUser>(
      applyRequestOverrides({
        endpoint: '/users',
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (authorSchema as WordPressStandardSchema<TUser>),
    );
  }

  /**
   * Updates one user.
   */
  async updateUser<TUser = WordPressAuthor>(
    id: number,
    input: UserWriteInput,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TUser> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TUser> {
    const resolved = this.resolveMutationArguments<TUser>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TUser>(
      applyRequestOverrides({
        endpoint: `/users/${id}`,
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (authorSchema as WordPressStandardSchema<TUser>),
    );
  }

  /**
   * Deletes one user.
   */
  async deleteUser(
    id: number,
    options: UserDeleteOptions & WordPressRequestOverrides = {},
  ): Promise<WordPressDeleteResult> {
    const params: Record<string, string> = {
      force: options.force === false ? 'false' : 'true',
    };

    if (typeof options.reassign === 'number') {
      params.reassign = String(options.reassign);
    }

    const { data, response } = await this.request<unknown>(applyRequestOverrides({
      endpoint: `/users/${id}`,
      method: 'DELETE',
      params,
    }, options, 'Mutation helper options'));

    throwIfWordPressError(response, data);

    if (
      typeof data === 'object'
      && data !== null
      && 'deleted' in data
      && (data as Record<string, unknown>).deleted === true
    ) {
      return {
        id,
        deleted: true,
        previous: (data as Record<string, unknown>).previous,
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
  async createComment<TComment = WordPressComment>(
    input: WordPressWritePayload,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TComment> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TComment> {
    const resolved = this.resolveMutationArguments<TComment>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TComment>(
      applyRequestOverrides({
        endpoint: '/comments',
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (commentSchema as WordPressStandardSchema<TComment>),
    );
  }

  /**
   * Updates one comment.
   */
  async updateComment<TComment = WordPressComment>(
    id: number,
    input: WordPressWritePayload,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TComment> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TComment> {
    const resolved = this.resolveMutationArguments<TComment>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TComment>(
      applyRequestOverrides({
        endpoint: `/comments/${id}`,
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (commentSchema as WordPressStandardSchema<TComment>),
    );
  }

  /**
   * Deletes one comment.
   */
  async deleteComment(
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data, response } = await this.request<unknown>(applyRequestOverrides({
      endpoint: `/comments/${id}`,
      method: 'DELETE',
      params,
    }, options, 'Mutation helper options'));

    throwIfWordPressError(response, data);

    if (
      typeof data === 'object'
      && data !== null
      && 'deleted' in data
      && (data as Record<string, unknown>).deleted === true
    ) {
      return {
        id,
        deleted: true,
        previous: (data as Record<string, unknown>).previous,
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
  async createMedia<TMedia = WordPressMedia>(
    input: WordPressWritePayload,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TMedia> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TMedia> {
    const resolved = this.resolveMutationArguments<TMedia>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TMedia>(
      applyRequestOverrides({
        endpoint: '/media',
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (mediaSchema as WordPressStandardSchema<TMedia>),
    );
  }

  /**
   * Uploads one binary media file and optionally applies metadata.
   */
  async uploadMedia(input: WordPressMediaUploadInput, requestOptions?: WordPressRequestOverrides): Promise<WordPressMedia> {
    const fileBody = input.file instanceof Blob
      ? input.file
      : input.file instanceof Uint8Array
        ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
        : input.file instanceof ArrayBuffer
          ? new Blob([new Uint8Array(input.file)], { type: input.mimeType ?? 'application/octet-stream' })
        : input.file;

    const safeFilename = input.filename.replace(/"/g, '');
    const uploadHeaders: Record<string, string> = {
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    };

    if (input.mimeType) {
      uploadHeaders['Content-Type'] = input.mimeType;
    }

    const created = await this.executeMutation<WordPressMedia>(
      applyRequestOverrides({
        endpoint: '/media',
        method: 'POST',
        rawBody: fileBody,
        headers: uploadHeaders,
        omitContentType: true,
      }, requestOptions, 'Mutation helper options'),
      mediaSchema,
    );

    const metadata: Record<string, unknown> = {};

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

    return this.updateMedia(created.id, metadata, undefined, requestOptions);
  }

  /**
   * Updates one media record.
   */
  async updateMedia<TMedia = WordPressMedia>(
    id: number,
    input: WordPressWritePayload,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TMedia> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TMedia> {
    const resolved = this.resolveMutationArguments<TMedia>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TMedia>(
      applyRequestOverrides({
        endpoint: `/media/${id}`,
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (mediaSchema as WordPressStandardSchema<TMedia>),
    );
  }

  /**
   * Deletes one media record.
   */
  async deleteMedia(
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data, response } = await this.request<unknown>(applyRequestOverrides({
      endpoint: `/media/${id}`,
      method: 'DELETE',
      params,
    }, options, 'Mutation helper options'));

    throwIfWordPressError(response, data);

    if (
      typeof data === 'object'
      && data !== null
      && 'deleted' in data
      && (data as Record<string, unknown>).deleted === true
    ) {
      return {
        id,
        deleted: true,
        previous: (data as Record<string, unknown>).previous,
      };
    }

    return {
      id,
      deleted: false,
    };
  }

  /**
   * Updates WordPress site settings with optional response validation.
   */
  async updateSettings<TSettings = WordPressSettings>(
    input: Partial<WordPressSettings> & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TSettings> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TSettings> {
    const resolved = this.resolveMutationArguments<TSettings>(responseSchemaOrRequestOptions, requestOptions);

    if (!this.hasAuth()) {
      throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
    }

    return this.executeMutation<TSettings>(
      applyRequestOverrides({
        endpoint: '/settings',
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (settingsSchema as WordPressStandardSchema<TSettings>),
    );
  }

  /**
   * Performs username/password JWT login against the WP JWT plugin endpoint.
   */
  async loginWithJwt<TJwtResponse = JwtAuthTokenResponse>(
    credentials: JwtLoginCredentials,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TJwtResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TJwtResponse> {
    const resolved = this.resolveMutationArguments<TJwtResponse>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TJwtResponse>(
      applyRequestOverrides({
        endpoint: '/wp-json/jwt-auth/v1/token',
        method: 'POST',
        body: credentials,
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (jwtAuthTokenResponseSchema as WordPressStandardSchema<TJwtResponse>),
    );
  }

  /**
   * Validates one JWT token with the WP JWT plugin endpoint.
   */
  async validateJwtToken<TJwtValidation = JwtAuthValidationResponse>(
    token?: string | JwtAuthCredentials,
    responseSchema?: WordPressStandardSchema<TJwtValidation>,
  ): Promise<TJwtValidation> {
    const authHeader = token
      ? createJwtAuthHeader(typeof token === 'string' ? token : token.token)
      : undefined;

    return this.executeMutation<TJwtValidation>(
      {
        endpoint: '/wp-json/jwt-auth/v1/token/validate',
        method: 'POST',
        auth: authHeader,
      },
      responseSchema ?? (jwtAuthValidationResponseSchema as WordPressStandardSchema<TJwtValidation>),
    );
  }

  /**
   * Starts one fluent REST ability builder with optional input/output validation.
   */
  ability<TInput = unknown, TOutput = unknown>(name: string): WordPressAbilityBuilder<TInput, TOutput> {
    return new WordPressAbilityBuilder<TInput, TOutput>({
      fetchAPI: this.fetchAPI.bind(this),
      request: this.request.bind(this),
    }, name);
  }

  /**
   * Creates one WPAPI-style request builder for any REST namespace/resource pair.
   */
  route<
    TResponse = unknown,
    TCreate extends Record<string, unknown> = Record<string, unknown>,
    TUpdate extends Record<string, unknown> = TCreate,
  >(
    resource: string,
    namespace = 'wp/v2',
  ): WordPressRequestBuilder<TResponse, TCreate, TUpdate> {
    const endpoint = this.createNamespacedEndpoint(resource, namespace);

    return new WordPressRequestBuilder<TResponse, TCreate, TUpdate>(
      {
        request: this.request.bind(this),
        createUrl: this.createApiUrlString.bind(this),
      },
      endpoint,
    );
  }

  /**
   * Returns one namespace-scoped request factory for custom/plugin routes.
   */
  namespace(namespace: string): WordPressNamespaceClient {
    const route = <
      TResponse = unknown,
      TCreate extends Record<string, unknown> = Record<string, unknown>,
      TUpdate extends Record<string, unknown> = TCreate,
    >(
      resource: string,
    ) => this.route<TResponse, TCreate, TUpdate>(resource, namespace);

    return {
      route,
      resource: route,
    };
  }

  /**
   * Registers one route factory following node-wpapi style route declarations.
   */
  registerRoute(
    namespace: string,
    route: string,
  ): () => WordPressRequestBuilder<unknown, Record<string, unknown>, Record<string, unknown>> {
    const normalizedRoute = route
      .replace(/\/\(\?P<[^>]+>[^)]+\)/g, '')
      .replace(/\/\(\?P<[^>]+>\)/g, '')
      .replace(/^\/+|\/+$/g, '');

    return () => this.route(normalizedRoute, namespace);
  }

  /**
   * Starts one WPAPI-style posts request chain.
   */
  posts(): WordPressRequestBuilder<
    WordPressPost | WordPressPost[],
    WordPressPostWriteBase & Record<string, unknown>,
    WordPressPostWriteBase & Record<string, unknown>
  > {
    return this.route('posts');
  }

  /**
   * Starts one WPAPI-style pages request chain.
   */
  pages(): WordPressRequestBuilder<
    WordPressPage | WordPressPage[],
    WordPressPostWriteBase & Record<string, unknown>,
    WordPressPostWriteBase & Record<string, unknown>
  > {
    return this.route('pages');
  }

  /**
   * Starts one WPAPI-style media request chain.
   */
  media(): WordPressRequestBuilder<WordPressMedia | WordPressMedia[], WordPressWritePayload, WordPressWritePayload> {
    return this.route('media');
  }

  /**
   * Starts one WPAPI-style categories request chain.
   */
  categories(): WordPressRequestBuilder<WordPressCategory | WordPressCategory[], TermWriteInput, TermWriteInput> {
    return this.route('categories');
  }

  /**
   * Starts one WPAPI-style tags request chain.
   */
  tags(): WordPressRequestBuilder<WordPressTag | WordPressTag[], TermWriteInput, TermWriteInput> {
    return this.route('tags');
  }

  /**
   * Starts one WPAPI-style users request chain.
   */
  users(): WordPressRequestBuilder<WordPressAuthor | WordPressAuthor[], UserWriteInput, UserWriteInput> {
    return this.route('users');
  }

  /**
   * Starts one WPAPI-style comments request chain.
   */
  comments(): WordPressRequestBuilder<WordPressComment | WordPressComment[], WordPressWritePayload, WordPressWritePayload> {
    return this.route('comments');
  }

  /**
   * Starts one WPAPI-style settings request chain.
   */
  settings(): WordPressRequestBuilder<WordPressSettings, Partial<WordPressSettings> & Record<string, unknown>> {
    return this.route('settings');
  }

  /**
   * Starts one WPAPI-style post types request chain.
   */
  types(): WordPressRequestBuilder<unknown> {
    return this.route('types');
  }

  /**
   * Starts one WPAPI-style taxonomies request chain.
   */
  taxonomies(): WordPressRequestBuilder<unknown> {
    return this.route('taxonomies');
  }

  /**
   * Starts one WPAPI-style statuses request chain.
   */
  statuses(): WordPressRequestBuilder<unknown> {
    return this.route('statuses');
  }

  /**
   * Starts one WPAPI-style search request chain.
   */
  search(): WordPressRequestBuilder<WordPressSearchResult[]> {
    return this.route('search');
  }

  /**
   * Performs a typed cross-resource search against the `/wp/v2/search` endpoint.
   *
   * Returns lightweight result objects across posts, pages, and custom post types.
   * Use the exported `searchResultSchema` to validate results when strict response
   * parsing is required.
   *
   * When `filter.subtype` is an array it is serialised using WordPress bracket
   * notation (`subtype[]=post&subtype[]=page`) so that multiple subtypes can be
   * filtered in a single request.
   *
   * @param query - The search string to query.
   * @param filter - Optional filter options (type, subtype, context, include, exclude, pagination).
   * @param requestOptions - Optional per-request transport overrides.
   */
  async searchContent<TResult = WordPressSearchResult>(
    query: string,
    filter?: Omit<SearchFilter, 'search'>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResult[]> {
    const { subtype, include, exclude, ...rest } = filter ?? {};
    const params: Record<string, string | string[]> = filterToParams({ ...rest, search: query });

    // Arrays use WordPress bracket notation (subtype[]=post&subtype[]=page).
    // Single strings are passed as a plain query param.
    if (subtype !== undefined) {
      params['subtype'] = subtype;
    }

    if (include !== undefined) {
      params['include'] = Array.isArray(include) ? include.map(String) : String(include);
    }

    if (exclude !== undefined) {
      params['exclude'] = Array.isArray(exclude) ? exclude.map(String) : String(exclude);
    }

    return this.fetchAPI<TResult[]>('/search', params, requestOptions);
  }

  /**
   * Starts one WPAPI-style block request chain.
   */
  blocks(): WordPressRequestBuilder<unknown, WordPressWritePayload, WordPressWritePayload> {
    return this.route('blocks');
  }

  /**
   * Starts one fluent post relation query by ID or slug.
   */
  post(idOrSlug: number | string): PostRelationQueryBuilder<[]> {
    if (typeof idOrSlug === 'number') {
      return new PostRelationQueryBuilder(this, { id: idOrSlug });
    }

    return new PostRelationQueryBuilder(this, { slug: idOrSlug });
  }

  /**
   * Fetches one post and resolves selected related entities in one call.
   */
  async getPostWithRelations<TRelations extends readonly PostRelation[]>(
    idOrSlug: number | string,
    ...relations: TRelations
  ): Promise<WordPressPost & { related: SelectedPostRelations<TRelations> }> {
    const query = this.post(idOrSlug).with(...relations);
    return query.get() as Promise<WordPressPost & { related: SelectedPostRelations<TRelations> }>;
  }

}

/**
 * Re-export selected client filter types alongside the class implementation.
 */
export type {
  CategoriesFilter,
  CommentsFilter,
  MediaFilter,
  PagesFilter,
  PostsFilter,
  SearchFilter,
  TagsFilter,
  UsersFilter,
};
