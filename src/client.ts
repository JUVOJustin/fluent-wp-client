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
import type {
  JwtAuthCredentials,
  JwtAuthTokenResponse,
  JwtAuthValidationResponse,
  JwtLoginCredentials,
} from './auth.js';
import type { WordPressRequestOverrides } from './types/resources.js';
import { PostsResource } from './resources/posts.js';
import { PagesResource } from './resources/pages.js';
import { MediaResource } from './resources/media.js';
import { CategoriesResource } from './resources/categories.js';
import { TagsResource } from './resources/tags.js';
import { UsersResource } from './resources/users.js';
import { SettingsResource } from './resources/settings.js';
import { CommentsResource } from './resources/comments.js';
import { GenericResourceRegistry } from './resources/content-terms.js';
import {
  type WordPressAuthor,
  type WordPressCategory,
  type WordPressComment,
  type WordPressMedia,
  type WordPressPage,
  type WordPressPost,
  type WordPressPostLike,
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
import { filterToParams } from './core/params.js';
import { WordPressTransport, createRuntime, type WordPressRuntime } from './core/transport.js';
import type {
  PostsFilter,
  PagesFilter,
  MediaFilter,
  CategoriesFilter,
  TagsFilter,
  UsersFilter,
  CommentsFilter,
  SearchFilter,
} from './types/filters.js';
import type {
  ContentResourceClient,
  PaginatedResponse,
  TermsResourceClient,
  ExtensibleFilter,
  QueryParams,
  PaginationParams,
  WordPressDeleteResult,
} from './types/resources.js';
import type { WordPressStandardSchema } from './core/validation.js';
import type { DeleteOptions, WordPressWritePayload, TermWriteInput, UserWriteInput, UserDeleteOptions } from './types/payloads.js';

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
 * 
 * This is the main entry point for the fluent-wp-client library.
 * It provides a flat API that delegates to underlying resource classes.
 * 
 * @example
 * ```typescript
 * const client = new WordPressClient({
 *   baseUrl: 'https://example.com',
 *   auth: { username: 'admin', password: 'secret' }
 * });
 * 
 * // Get posts
 * const posts = await client.getPosts();
 * 
 * // Get single post with block parsing
 * const post = await client.getPost(123).get();
 * const blocks = await client.getPost(123).getBlocks();
 * 
 * // WPAPI-style chaining
 * const published = await client.posts().status('publish').get();
 * 
 * // Generic content (custom post types)
 * const books = client.content('books');
 * const allBooks = await books.list();
 * ```
 */
export class WordPressClient {
  private readonly transport: WordPressTransport;
  private readonly runtime: WordPressRuntime;
  
  // Resource instances (private to avoid naming conflicts with public methods)
  private readonly postsResource: PostsResource;
  private readonly pagesResource: PagesResource;
  private readonly mediaResource: MediaResource;
  private readonly categoriesResource: CategoriesResource;
  private readonly tagsResource: TagsResource;
  private readonly usersResource: UsersResource;
  private readonly settingsResource: SettingsResource;
  private readonly commentsResource: CommentsResource;
  private readonly genericResourcesRegistry: GenericResourceRegistry;
  private readonly abilityMethods: ReturnType<typeof createAbilityMethods>;

  /**
   * Creates a new WordPress API client.
   */
  constructor(config: WordPressClientConfig) {
    // Initialize transport layer
    this.transport = new WordPressTransport({
      baseUrl: config.baseUrl,
      auth: config.authHeader ? config.authHeader : config.auth,
      authHeaders: config.authHeaders,
      cookies: config.cookies,
      credentials: config.credentials,
      fetch: config.fetch,
    });

    // Create runtime interface
    this.runtime = createRuntime(this.transport);

    // Initialize resource instances
    this.postsResource = PostsResource.create(this.runtime, config.blockParser);
    this.pagesResource = PagesResource.create(this.runtime, config.blockParser);
    this.mediaResource = MediaResource.create(this.runtime);
    this.categoriesResource = CategoriesResource.create(this.runtime);
    this.tagsResource = TagsResource.create(this.runtime);
    this.usersResource = UsersResource.create(this.runtime);
    this.settingsResource = SettingsResource.create(this.runtime);
    this.commentsResource = CommentsResource.create(this.runtime);
    this.genericResourcesRegistry = new GenericResourceRegistry({
      runtime: this.runtime,
      relationClient: this,
    });
    this.abilityMethods = createAbilityMethods({
      fetchAPI: this.runtime.fetchAPI.bind(this.runtime),
      request: this.runtime.request.bind(this.runtime),
    });
  }

  // ============= TRANSPORT FACADE =============

  /**
   * Sets headers used by all subsequent requests from this client instance.
   */
  setHeaders(name: string, value: string): this;
  setHeaders(headers: Record<string, string>): this;
  setHeaders(nameOrHeaders: string | Record<string, string>, value?: string): this {
    if (typeof nameOrHeaders === 'string') {
      this.transport.setHeaders(nameOrHeaders, value ?? '');
    } else {
      this.transport.setHeaders(nameOrHeaders);
    }
    return this;
  }

  /**
   * Returns whether authentication is configured on this client instance.
   */
  hasAuth(): boolean {
    return this.runtime.hasAuth();
  }

  /**
   * Executes one low-level WordPress request.
   */
  request<T = unknown>(options: WordPressRequestOptions): Promise<WordPressRequestResult<T>> {
    return this.runtime.request(options);
  }

  // ============= POSTS API =============

  getPosts(filter?: ExtensibleFilter<PostsFilter>, options?: WordPressRequestOverrides): Promise<WordPressPost[]> {
    return this.postsResource.getPosts(filter, options);
  }

  getAllPosts(filter?: Omit<ExtensibleFilter<PostsFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressPost[]> {
    return this.postsResource.getAllPosts(filter, options);
  }

  getPostsPaginated(filter?: ExtensibleFilter<PostsFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressPost>> {
    return this.postsResource.getPostsPaginated(filter, options);
  }

  getPost(id: number, options?: WordPressRequestOverrides) {
    return this.postsResource.getPost(id, options);
  }

  getPostBySlug(slug: string, options?: WordPressRequestOverrides) {
    return this.postsResource.getPostBySlug(slug, options);
  }

  createPost<TResponse = WordPressPost>(
    input: WordPressPostWriteBase,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    return this.postsResource.create(input, responseSchemaOrRequestOptions, requestOptions);
  }

  updatePost<TResponse = WordPressPost>(
    id: number,
    input: WordPressPostWriteBase,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    return this.postsResource.update(id, input, responseSchemaOrRequestOptions, requestOptions);
  }

  deletePost(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult> {
    return this.postsResource.delete(id, options);
  }

  // ============= PAGES API =============

  getPages(filter?: ExtensibleFilter<PagesFilter>, options?: WordPressRequestOverrides): Promise<WordPressPage[]> {
    return this.pagesResource.getPages(filter, options);
  }

  getAllPages(filter?: Omit<ExtensibleFilter<PagesFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressPage[]> {
    return this.pagesResource.getAllPages(filter, options);
  }

  getPagesPaginated(filter?: ExtensibleFilter<PagesFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressPage>> {
    return this.pagesResource.getPagesPaginated(filter, options);
  }

  getPage(id: number, options?: WordPressRequestOverrides) {
    return this.pagesResource.getPage(id, options);
  }

  getPageBySlug(slug: string, options?: WordPressRequestOverrides) {
    return this.pagesResource.getPageBySlug(slug, options);
  }

  createPage<TResponse = WordPressPage>(
    input: WordPressPostWriteBase,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    return this.pagesResource.create(input, responseSchemaOrRequestOptions, requestOptions);
  }

  updatePage<TResponse = WordPressPage>(
    id: number,
    input: WordPressPostWriteBase,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    return this.pagesResource.update(id, input, responseSchemaOrRequestOptions, requestOptions);
  }

  deletePage(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult> {
    return this.pagesResource.delete(id, options);
  }

  // ============= MEDIA API =============

  getMedia(filter?: ExtensibleFilter<MediaFilter>, options?: WordPressRequestOverrides): Promise<WordPressMedia[]> {
    return this.mediaResource.getMedia(filter, options);
  }

  getAllMedia(filter?: Omit<ExtensibleFilter<MediaFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressMedia[]> {
    return this.mediaResource.getAllMedia(filter, options);
  }

  getMediaPaginated(filter?: ExtensibleFilter<MediaFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressMedia>> {
    return this.mediaResource.getMediaPaginated(filter, options);
  }

  getMediaItem(id: number, options?: WordPressRequestOverrides): Promise<WordPressMedia> {
    return this.mediaResource.getMediaItem(id, options);
  }

  getMediaBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressMedia | undefined> {
    return this.mediaResource.getMediaBySlug(slug, options);
  }

  getImageUrl(media: WordPressMedia, size?: string): string {
    return this.mediaResource.getImageUrl(media, size);
  }

  createMedia(input: WordPressWritePayload, options?: WordPressRequestOverrides): Promise<WordPressMedia> {
    return this.mediaResource.create(input, options);
  }

  uploadMedia(input: WordPressMediaUploadInput, options?: WordPressRequestOverrides): Promise<WordPressMedia> {
    return this.mediaResource.upload(input, options);
  }

  updateMedia(id: number, input: WordPressWritePayload, options?: WordPressRequestOverrides): Promise<WordPressMedia> {
    return this.mediaResource.update(id, input, options);
  }

  deleteMedia(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult> {
    return this.mediaResource.delete(id, options);
  }

  // ============= CATEGORIES API =============

  getCategories(filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> {
    return this.categoriesResource.getCategories(filter, options);
  }

  getAllCategories(filter?: Omit<ExtensibleFilter<CategoriesFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> {
    return this.categoriesResource.getAllCategories(filter, options);
  }

  getCategoriesPaginated(filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressCategory>> {
    return this.categoriesResource.getCategoriesPaginated(filter, options);
  }

  getCategory(id: number, options?: WordPressRequestOverrides): Promise<WordPressCategory> {
    return this.categoriesResource.getCategory(id, options);
  }

  getCategoryBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressCategory | undefined> {
    return this.categoriesResource.getCategoryBySlug(slug, options);
  }

  createCategory(input: TermWriteInput, options?: WordPressRequestOverrides): Promise<WordPressCategory> {
    return this.categoriesResource.create(input, options);
  }

  updateCategory(id: number, input: TermWriteInput, options?: WordPressRequestOverrides): Promise<WordPressCategory> {
    return this.categoriesResource.update(id, input, options);
  }

  deleteCategory(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult> {
    return this.categoriesResource.delete(id, options);
  }

  // ============= TAGS API =============

  getTags(filter?: ExtensibleFilter<TagsFilter>, options?: WordPressRequestOverrides): Promise<WordPressTag[]> {
    return this.tagsResource.getTags(filter, options);
  }

  getAllTags(filter?: Omit<ExtensibleFilter<TagsFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressTag[]> {
    return this.tagsResource.getAllTags(filter, options);
  }

  getTagsPaginated(filter?: ExtensibleFilter<TagsFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressTag>> {
    return this.tagsResource.getTagsPaginated(filter, options);
  }

  getTag(id: number, options?: WordPressRequestOverrides): Promise<WordPressTag> {
    return this.tagsResource.getTag(id, options);
  }

  getTagBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressTag | undefined> {
    return this.tagsResource.getTagBySlug(slug, options);
  }

  createTag(input: TermWriteInput, options?: WordPressRequestOverrides): Promise<WordPressTag> {
    return this.tagsResource.create(input, options);
  }

  updateTag(id: number, input: TermWriteInput, options?: WordPressRequestOverrides): Promise<WordPressTag> {
    return this.tagsResource.update(id, input, options);
  }

  deleteTag(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult> {
    return this.tagsResource.delete(id, options);
  }

  // ============= USERS API =============

  getUsers(filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides): Promise<WordPressAuthor[]> {
    return this.usersResource.getUsers(filter, options);
  }

  getAllUsers(filter?: Omit<ExtensibleFilter<UsersFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressAuthor[]> {
    return this.usersResource.getAllUsers(filter, options);
  }

  getUsersPaginated(filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressAuthor>> {
    return this.usersResource.getUsersPaginated(filter, options);
  }

  getUser(id: number, options?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    return this.usersResource.getUser(id, options);
  }

  getCurrentUser(options?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    return this.usersResource.getCurrentUser(options);
  }

  createUser(input: UserWriteInput, options?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    return this.usersResource.create(input, options);
  }

  updateUser(id: number, input: UserWriteInput, options?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    return this.usersResource.update(id, input, options);
  }

  deleteUser(id: number, options?: WordPressRequestOverrides & UserDeleteOptions): Promise<WordPressDeleteResult> {
    return this.usersResource.delete(id, options);
  }

  // ============= SETTINGS API =============

  getSettings(options?: WordPressRequestOverrides): Promise<WordPressSettings> {
    return this.settingsResource.getSettings(options);
  }

  updateSettings<TSettings = WordPressSettings>(
    input: Partial<WordPressSettings> & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TSettings> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TSettings> {
    return this.settingsResource.updateSettings(input, responseSchemaOrRequestOptions, requestOptions);
  }

  // ============= COMMENTS API =============

  getComments(filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides): Promise<WordPressComment[]> {
    return this.commentsResource.getComments(filter, options);
  }

  getAllComments(filter?: Omit<ExtensibleFilter<CommentsFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressComment[]> {
    return this.commentsResource.getAllComments(filter, options);
  }

  getCommentsPaginated(filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressComment>> {
    return this.commentsResource.getCommentsPaginated(filter, options);
  }

  getComment(id: number, options?: WordPressRequestOverrides): Promise<WordPressComment> {
    return this.commentsResource.getComment(id, options);
  }

  createComment(input: WordPressWritePayload, options?: WordPressRequestOverrides): Promise<WordPressComment> {
    return this.commentsResource.create(input, options);
  }

  updateComment(id: number, input: WordPressWritePayload, options?: WordPressRequestOverrides): Promise<WordPressComment> {
    return this.commentsResource.update(id, input, options);
  }

  deleteComment(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult> {
    return this.commentsResource.delete(id, options);
  }

  // ============= GENERIC CONTENT API =============

  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, WordPressWritePayload, WordPressWritePayload> {
    return this.genericResourcesRegistry.content(resource, responseSchema);
  }

  // ============= GENERIC TERMS API =============

  terms<TResource = WordPressCategory>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): TermsResourceClient<TResource, TermWriteInput, TermWriteInput> {
    return this.genericResourcesRegistry.terms(resource, responseSchema);
  }

  // ============= WPAPI-STYLE CHAINING API =============

  /**
   * Creates a WPAPI-style request builder for any REST namespace/resource pair.
   */
  route<
    TResponse = unknown,
    TCreate extends Record<string, unknown> = Record<string, unknown>,
    TUpdate extends Record<string, unknown> = TCreate,
  >(
    resource: string,
    namespace = 'wp/v2',
  ): WordPressRequestBuilder<TResponse, TCreate, TUpdate> {
    const normalizedNamespace = namespace.replace(/^\/+|\/+$/g, '');
    const normalizedResource = resource.replace(/^\/+|\/+$/g, '');

    if (!normalizedResource) {
      throw new Error('Resource path must not be empty.');
    }

    const endpoint = normalizedNamespace === 'wp/v2'
      ? `/${normalizedResource}`
      : `/wp-json/${normalizedNamespace}/${normalizedResource}`;

    return new WordPressRequestBuilder<TResponse, TCreate, TUpdate>(
      {
        request: this.runtime.request.bind(this.runtime),
        createUrl: this.transport.createApiUrlString.bind(this.transport),
      },
      endpoint,
    );
  }

  /**
   * Returns a namespace-scoped request factory for custom/plugin routes.
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
   * Registers a route factory following node-wpapi style route declarations.
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
   * Starts a WPAPI-style posts request chain.
   */
  posts(): WordPressRequestBuilder<
    WordPressPost | WordPressPost[],
    WordPressPostWriteBase & Record<string, unknown>,
    WordPressPostWriteBase & Record<string, unknown>
  > {
    return this.route('posts');
  }

  /**
   * Starts a WPAPI-style pages request chain.
   */
  pages(): WordPressRequestBuilder<
    WordPressPage | WordPressPage[],
    WordPressPostWriteBase & Record<string, unknown>,
    WordPressPostWriteBase & Record<string, unknown>
  > {
    return this.route('pages');
  }

  /**
   * Starts a WPAPI-style media request chain.
   */
  media(): WordPressRequestBuilder<WordPressMedia | WordPressMedia[], WordPressWritePayload, WordPressWritePayload> {
    return this.route('media');
  }

  /**
   * Starts a WPAPI-style categories request chain.
   */
  categories(): WordPressRequestBuilder<WordPressCategory | WordPressCategory[], TermWriteInput, TermWriteInput> {
    return this.route('categories');
  }

  /**
   * Starts a WPAPI-style tags request chain.
   */
  tags(): WordPressRequestBuilder<WordPressTag | WordPressTag[], TermWriteInput, TermWriteInput> {
    return this.route('tags');
  }

  /**
   * Starts a WPAPI-style users request chain.
   */
  users(): WordPressRequestBuilder<WordPressAuthor | WordPressAuthor[], UserWriteInput, UserWriteInput> {
    return this.route('users');
  }

  /**
   * Starts a WPAPI-style comments request chain.
   */
  comments(): WordPressRequestBuilder<WordPressComment | WordPressComment[], WordPressWritePayload, WordPressWritePayload> {
    return this.route('comments');
  }

  /**
   * Starts a WPAPI-style settings request chain.
   */
  settings(): WordPressRequestBuilder<WordPressSettings, Partial<WordPressSettings> & Record<string, unknown>> {
    return this.route('settings');
  }

  /**
   * Starts a WPAPI-style post types request chain.
   */
  types(): WordPressRequestBuilder<unknown> {
    return this.route('types');
  }

  /**
   * Starts a WPAPI-style taxonomies request chain.
   */
  taxonomies(): WordPressRequestBuilder<unknown> {
    return this.route('taxonomies');
  }

  /**
   * Starts a WPAPI-style statuses request chain.
   */
  statuses(): WordPressRequestBuilder<unknown> {
    return this.route('statuses');
  }

  /**
   * Starts a WPAPI-style search request chain.
   */
  search(query?: string): WordPressRequestBuilder<WordPressSearchResult[]> {
    const builder = this.route('search') as WordPressRequestBuilder<WordPressSearchResult[]>;
    return query !== undefined ? builder.search(query) : builder;
  }

  /**
   * Performs a typed cross-resource search against the /wp/v2/search endpoint.
   */
  async searchContent<TResult = WordPressSearchResult>(
    query: string,
    filter?: Omit<SearchFilter, 'search'>,
    options?: WordPressRequestOverrides,
  ): Promise<TResult[]> {
    const params = filterToParams({ ...filter, search: query });
    return this.runtime.fetchAPI<TResult[]>('/search', params, options);
  }

  /**
   * Starts a WPAPI-style block request chain.
   */
  blocks(): WordPressRequestBuilder<unknown, WordPressWritePayload, WordPressWritePayload> {
    return this.route('blocks');
  }

  // ============= RELATION API =============

  /**
   * Starts a fluent post relation query by ID or slug.
   */
  post(idOrSlug: number | string): PostRelationQueryBuilder<[]> {
    return new PostRelationQueryBuilder(
      this,
      typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
      (id) => this.getPost(id),
      (slug) => this.getPostBySlug(slug),
    );
  }

  /**
   * Fetches a post and resolves selected related entities in one call.
   */
  async getPostWithRelations<TRelations extends readonly PostRelation[]>(
    idOrSlug: number | string,
    ...relations: TRelations
  ): Promise<WordPressPost & { related: SelectedPostRelations<TRelations> }> {
    const query = this.post(idOrSlug).with(...relations);
    return query.get() as Promise<WordPressPost & { related: SelectedPostRelations<TRelations> }>;
  }

  // ============= ABILITIES API =============

  /**
   * Starts a fluent REST ability builder with optional input/output validation.
   */
  ability<TInput = unknown, TOutput = unknown>(name: string): WordPressAbilityBuilder<TInput, TOutput> {
    return this.abilityMethods.ability<TInput, TOutput>(name);
  }

  /**
   * Lists all registered abilities exposed to the current caller.
   */
  async getAbilities(options?: WordPressRequestOverrides) {
    return this.abilityMethods.getAbilities(options);
  }

  /**
   * Fetches metadata for one registered ability.
   */
  async getAbility(name: string, options?: WordPressRequestOverrides) {
    return this.abilityMethods.getAbility(name, options);
  }

  /**
   * Lists all ability categories exposed to the current caller.
   */
  async getAbilityCategories(options?: WordPressRequestOverrides) {
    return this.abilityMethods.getAbilityCategories(options);
  }

  /**
   * Fetches one ability category by slug.
   */
  async getAbilityCategory(slug: string, options?: WordPressRequestOverrides) {
    return this.abilityMethods.getAbilityCategory(slug, options);
  }

  /**
   * Executes one read-only ability through GET /run.
   */
  async executeGetAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
    options?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return this.abilityMethods.executeGetAbility(name, input, responseSchema, options);
  }

  /**
   * Executes one regular ability through POST /run.
   */
  async executeRunAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
    options?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return this.abilityMethods.executeRunAbility(name, input, responseSchema, options);
  }

  /**
   * Executes one destructive ability through DELETE /run.
   */
  async executeDeleteAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
    options?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return this.abilityMethods.executeDeleteAbility(name, input, responseSchema, options);
  }

  // ============= AUTHENTICATION HELPERS =============

  /**
   * Performs username/password JWT login against the WP JWT plugin endpoint.
   */
  async loginWithJwt(
    credentials: JwtLoginCredentials,
    options?: WordPressRequestOverrides,
  ): Promise<JwtAuthTokenResponse> {
    return this.transport.loginWithJwt(credentials);
  }

  /**
   * Validates one JWT token with the WP JWT plugin endpoint.
   */
  async validateJwtToken(
    token?: string | JwtAuthCredentials,
    options?: WordPressRequestOverrides,
  ): Promise<JwtAuthValidationResponse> {
    return this.transport.validateJwtToken(token);
  }
}
