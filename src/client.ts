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
  WordPressRequestResult,
} from './types/client.js';
import type { WordPressRequestOverrides } from './types/resources.js';
import { createPostsResource } from './resources/posts.js';
import { createPagesResource } from './resources/pages.js';
import { createMediaResource } from './resources/media.js';
import { createCategoriesResource } from './resources/categories.js';
import { createTagsResource } from './resources/tags.js';
import { createUsersResource } from './resources/users.js';
import { createSettingsMethods } from './resources/settings.js';
import { createCommentsResource } from './resources/comments.js';
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
import { compactPayload, filterToParams, normalizeDeleteResult } from './core/params.js';
import type {
  BaseContentFilter,
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
  public getPosts: ReturnType<typeof createPostsResource>['getPosts'];
  public getAllPosts: ReturnType<typeof createPostsResource>['getAllPosts'];
  public getPostsPaginated: ReturnType<typeof createPostsResource>['getPostsPaginated'];
  public getPost: ReturnType<typeof createPostsResource>['getPost'];
  public getPostBySlug: ReturnType<typeof createPostsResource>['getPostBySlug'];
  public createPost: ReturnType<typeof createPostsResource>['create'];
  public updatePost: ReturnType<typeof createPostsResource>['update'];
  public deletePost: ReturnType<typeof createPostsResource>['delete'];

  // Pages methods
  public getPages: ReturnType<typeof createPagesResource>['getPages'];
  public getAllPages: ReturnType<typeof createPagesResource>['getAllPages'];
  public getPagesPaginated: ReturnType<typeof createPagesResource>['getPagesPaginated'];
  public getPage: ReturnType<typeof createPagesResource>['getPage'];
  public getPageBySlug: ReturnType<typeof createPagesResource>['getPageBySlug'];
  public createPage: ReturnType<typeof createPagesResource>['create'];
  public updatePage: ReturnType<typeof createPagesResource>['update'];
  public deletePage: ReturnType<typeof createPagesResource>['delete'];

  // Media methods
  public getMedia: ReturnType<typeof createMediaResource>['getMedia'];
  public getAllMedia: ReturnType<typeof createMediaResource>['getAllMedia'];
  public getMediaPaginated: ReturnType<typeof createMediaResource>['getMediaPaginated'];
  public getMediaItem: ReturnType<typeof createMediaResource>['getMediaItem'];
  public getMediaBySlug: ReturnType<typeof createMediaResource>['getMediaBySlug'];
  public getImageUrl: ReturnType<typeof createMediaResource>['getImageUrl'];
  public createMedia: ReturnType<typeof createMediaResource>['create'];
  public uploadMedia: ReturnType<typeof createMediaResource>['upload'];
  public updateMedia: ReturnType<typeof createMediaResource>['update'];
  public deleteMedia: ReturnType<typeof createMediaResource>['delete'];

  // Categories methods
  public getCategories: ReturnType<typeof createCategoriesResource>['getCategories'];
  public getAllCategories: ReturnType<typeof createCategoriesResource>['getAllCategories'];
  public getCategoriesPaginated: ReturnType<typeof createCategoriesResource>['getCategoriesPaginated'];
  public getCategory: ReturnType<typeof createCategoriesResource>['getCategory'];
  public getCategoryBySlug: ReturnType<typeof createCategoriesResource>['getCategoryBySlug'];
  public createCategory: ReturnType<typeof createCategoriesResource>['create'];
  public updateCategory: ReturnType<typeof createCategoriesResource>['update'];
  public deleteCategory: ReturnType<typeof createCategoriesResource>['delete'];

  // Tags methods
  public getTags: ReturnType<typeof createTagsResource>['getTags'];
  public getAllTags: ReturnType<typeof createTagsResource>['getAllTags'];
  public getTagsPaginated: ReturnType<typeof createTagsResource>['getTagsPaginated'];
  public getTag: ReturnType<typeof createTagsResource>['getTag'];
  public getTagBySlug: ReturnType<typeof createTagsResource>['getTagBySlug'];
  public createTag: ReturnType<typeof createTagsResource>['create'];
  public updateTag: ReturnType<typeof createTagsResource>['update'];
  public deleteTag: ReturnType<typeof createTagsResource>['delete'];

  // Users methods
  public getUsers: ReturnType<typeof createUsersResource>['getUsers'];
  public getAllUsers: ReturnType<typeof createUsersResource>['getAllUsers'];
  public getUsersPaginated: ReturnType<typeof createUsersResource>['getUsersPaginated'];
  public getUser: ReturnType<typeof createUsersResource>['getUser'];
  public getCurrentUser: ReturnType<typeof createUsersResource>['getCurrentUser'];
  public createUser: ReturnType<typeof createUsersResource>['create'];
  public updateUser: ReturnType<typeof createUsersResource>['update'];
  public deleteUser: ReturnType<typeof createUsersResource>['delete'];

  // Settings methods
  public getSettings: ReturnType<typeof createSettingsMethods>['getSettings'];

  // Comments methods
  public getComments: ReturnType<typeof createCommentsResource>['getComments'];
  public getAllComments: ReturnType<typeof createCommentsResource>['getAllComments'];
  public getCommentsPaginated: ReturnType<typeof createCommentsResource>['getCommentsPaginated'];
  public getComment: ReturnType<typeof createCommentsResource>['getComment'];
  public createComment: ReturnType<typeof createCommentsResource>['create'];
  public updateComment: ReturnType<typeof createCommentsResource>['update'];
  public deleteComment: ReturnType<typeof createCommentsResource>['delete'];

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

    const executeMutation = this.executeMutation.bind(this);
    const resourceDeps = { fetchAPI, fetchAPIPaginated, executeMutation, request };

    const posts = createPostsResource(resourceDeps, config.blockParser);
    this.getPosts = posts.getPosts;
    this.getAllPosts = posts.getAllPosts;
    this.getPostsPaginated = posts.getPostsPaginated;
    this.getPost = posts.getPost;
    this.getPostBySlug = posts.getPostBySlug;
    this.createPost = posts.create;
    this.updatePost = posts.update;
    this.deletePost = posts.delete;

    const pages = createPagesResource(resourceDeps, config.blockParser);
    this.getPages = pages.getPages;
    this.getAllPages = pages.getAllPages;
    this.getPagesPaginated = pages.getPagesPaginated;
    this.getPage = pages.getPage;
    this.getPageBySlug = pages.getPageBySlug;
    this.createPage = pages.create;
    this.updatePage = pages.update;
    this.deletePage = pages.delete;

    const media = createMediaResource(resourceDeps);
    this.getMedia = media.getMedia;
    this.getAllMedia = media.getAllMedia;
    this.getMediaPaginated = media.getMediaPaginated;
    this.getMediaItem = media.getMediaItem;
    this.getMediaBySlug = media.getMediaBySlug;
    this.getImageUrl = media.getImageUrl;
    this.createMedia = media.create;
    this.uploadMedia = media.upload;
    this.updateMedia = media.update;
    this.deleteMedia = media.delete;

    const categories = createCategoriesResource(resourceDeps);
    this.getCategories = categories.getCategories;
    this.getAllCategories = categories.getAllCategories;
    this.getCategoriesPaginated = categories.getCategoriesPaginated;
    this.getCategory = categories.getCategory;
    this.getCategoryBySlug = categories.getCategoryBySlug;
    this.createCategory = categories.create;
    this.updateCategory = categories.update;
    this.deleteCategory = categories.delete;

    const tags = createTagsResource(resourceDeps);
    this.getTags = tags.getTags;
    this.getAllTags = tags.getAllTags;
    this.getTagsPaginated = tags.getTagsPaginated;
    this.getTag = tags.getTag;
    this.getTagBySlug = tags.getTagBySlug;
    this.createTag = tags.create;
    this.updateTag = tags.update;
    this.deleteTag = tags.delete;

    const users = createUsersResource(resourceDeps, hasAuth);
    this.getUsers = users.getUsers;
    this.getAllUsers = users.getAllUsers;
    this.getUsersPaginated = users.getUsersPaginated;
    this.getUser = users.getUser;
    this.getCurrentUser = users.getCurrentUser;
    this.createUser = users.create;
    this.updateUser = users.update;
    this.deleteUser = users.delete;

    const settings = createSettingsMethods(fetchAPI, hasAuth);
    this.getSettings = settings.getSettings;

    const comments = createCommentsResource(resourceDeps);
    this.getComments = comments.getComments;
    this.getAllComments = comments.getAllComments;
    this.getCommentsPaginated = comments.getCommentsPaginated;
    this.getComment = comments.getComment;
    this.createComment = comments.create;
    this.updateComment = comments.update;
    this.deleteComment = comments.delete;

    const contentTerms = createContentTermMethods({
      fetchAPI,
      fetchAPIPaginated,
      request,
      executeMutation,
      relationClient: this,
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
   *
   * When `query` is provided it is set as the `search` parameter immediately,
   * so `.search('test').get()` works without a redundant chained `.search()` call.
   */
  search(query?: string): WordPressRequestBuilder<WordPressSearchResult[]> {
    const builder = this.route('search') as WordPressRequestBuilder<WordPressSearchResult[]>;
    return query !== undefined ? builder.search(query) : builder;
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
    const params = filterToParams({ ...filter, search: query });
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
      return new PostRelationQueryBuilder(this, { id: idOrSlug }, (id) => this.getPost(id), (slug) => this.getPostBySlug(slug));
    }

    return new PostRelationQueryBuilder(this, { slug: idOrSlug }, (id) => this.getPost(id), (slug) => this.getPostBySlug(slug));
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
