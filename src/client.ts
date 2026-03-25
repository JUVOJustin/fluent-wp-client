import {
  WordPressAbilityBuilder,
  createAbilityMethods,
} from './abilities.js';
import type {
  WordPressClientConfig,
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
import type {
  WordPressDiscoveryCatalog,
  WordPressDiscoveryOptions,
} from './types/discovery.js';
import { MediaResource, createMediaClient } from './resources/media.js';
import { UsersResource, createUsersClient } from './resources/users.js';
import { SettingsResource, createSettingsClient } from './resources/settings.js';
import { CommentsResource, createCommentsClient } from './resources/comments.js';
import { GenericResourceRegistry } from './resources/registry.js';
import {
  createDiscoveryMethods,
  type DiscoveryMethods,
} from './discovery.js';
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
  CommentsResourceClient,
  ExtensibleFilter,
  MediaResourceClient,
  QueryParams,
  TermsResourceClient,
  PaginationParams,
  SettingsResourceClient,
  UsersResourceClient,
} from './types/resources.js';
import type { WordPressStandardSchema } from './core/validation.js';
import type { PostRelationClient } from './builders/relations.js';
import type { TermWriteInput, UserWriteInput, WordPressWritePayload } from './types/payloads.js';

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
 * // Read posts through the unified content API
 * const posts = client.content('posts');
 * const recentPosts = await posts.list({ perPage: 10 });
 * 
 * // Single-item queries are awaitable and expose block helpers
 * const post = await posts.item(123);
 * const blocks = await posts.item(123).getBlocks();
 * 
 * // Custom post types use the same API surface
 * const books = client.content('books');
 * const allBooks = await books.list();
 * ```
 */
export class WordPressClient {
  private readonly transport: WordPressTransport;
  private readonly runtime: WordPressRuntime;
  
  // Resource instances (private to avoid naming conflicts with public methods)
  private readonly mediaResource: MediaResource;
  private readonly usersResource: UsersResource;
  private readonly settingsResource: SettingsResource;
  private readonly commentsResource: CommentsResource;
  private readonly genericResourcesRegistry: GenericResourceRegistry;
  private readonly abilityMethods: ReturnType<typeof createAbilityMethods>;
  private readonly discoveryMethods: DiscoveryMethods;

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
    this.mediaResource = MediaResource.create(this.runtime);
    this.usersResource = UsersResource.create(this.runtime);
    this.settingsResource = SettingsResource.create(this.runtime);
    this.commentsResource = CommentsResource.create(this.runtime);
    this.discoveryMethods = createDiscoveryMethods(this.runtime);

    const relationClient: PostRelationClient = {
      content: this.content.bind(this),
      request: this.request.bind(this),
      users: () => this.users(),
      media: () => this.media(),
      terms: this.terms.bind(this),
    };

    this.genericResourcesRegistry = new GenericResourceRegistry({
      defaultBlockParser: config.blockParser,
      runtime: this.runtime,
      relationClient,
      discoveryMethods: this.discoveryMethods,
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

  // ============= FIRST-CLASS RESOURCE API =============

  media(): MediaResourceClient<WordPressMedia, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload>;
  media<TResource extends WordPressMedia>(
    responseSchema: WordPressStandardSchema<TResource>,
  ): MediaResourceClient<TResource, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload>;
  media<TResource extends WordPressMedia = WordPressMedia>(
    responseSchema?: WordPressStandardSchema<TResource>,
  ): MediaResourceClient<TResource, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload> {
    return createMediaClient(this.mediaResource, responseSchema, (options) =>
      this.discoveryMethods.describeResource('media', options),
    );
  }

  comments(): CommentsResourceClient<WordPressComment, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload>;
  comments<TResource extends WordPressComment>(
    responseSchema: WordPressStandardSchema<TResource>,
  ): CommentsResourceClient<TResource, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload>;
  comments<TResource extends WordPressComment = WordPressComment>(
    responseSchema?: WordPressStandardSchema<TResource>,
  ): CommentsResourceClient<TResource, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload> {
    return createCommentsClient(this.commentsResource, responseSchema, (options) =>
      this.discoveryMethods.describeResource('comments', options),
    );
  }

  users(): UsersResourceClient<WordPressAuthor, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput>;
  users<TResource extends WordPressAuthor>(
    responseSchema: WordPressStandardSchema<TResource>,
  ): UsersResourceClient<TResource, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput>;
  users<TResource extends WordPressAuthor = WordPressAuthor>(
    responseSchema?: WordPressStandardSchema<TResource>,
  ): UsersResourceClient<TResource, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput> {
    return createUsersClient(this.usersResource, responseSchema, (options) =>
      this.discoveryMethods.describeResource('users', options),
    );
  }

  settings(): SettingsResourceClient<WordPressSettings>;
  settings<TResource extends WordPressSettings>(
    responseSchema: WordPressStandardSchema<TResource>,
  ): SettingsResourceClient<TResource>;
  settings<TResource extends WordPressSettings = WordPressSettings>(
    responseSchema?: WordPressStandardSchema<TResource>,
  ): SettingsResourceClient<TResource> {
    return createSettingsClient(this.settingsResource, responseSchema, (options) =>
      this.discoveryMethods.describeResource('settings', options),
    );
  }

  // ============= GENERIC CONTENT API =============

  content(
    resource: 'posts',
  ): ContentResourceClient<WordPressPost, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike>(
    resource: 'posts',
    responseSchema: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content(
    resource: 'pages',
  ): ContentResourceClient<WordPressPage, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike>(
    resource: 'pages',
    responseSchema: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload>;
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
    return this.genericResourcesRegistry.content(resource, responseSchema);
  }

  // ============= GENERIC TERMS API =============

  terms(
    resource: 'categories',
  ): TermsResourceClient<WordPressCategory, ExtensibleFilter<CategoriesFilter>, TermWriteInput, TermWriteInput>;
  terms<TResource>(
    resource: 'categories',
    responseSchema: WordPressStandardSchema<TResource>,
  ): TermsResourceClient<TResource, ExtensibleFilter<CategoriesFilter>, TermWriteInput, TermWriteInput>;
  terms(
    resource: 'tags',
  ): TermsResourceClient<WordPressTag, ExtensibleFilter<TagsFilter>, TermWriteInput, TermWriteInput>;
  terms<TResource>(
    resource: 'tags',
    responseSchema: WordPressStandardSchema<TResource>,
  ): TermsResourceClient<TResource, ExtensibleFilter<TagsFilter>, TermWriteInput, TermWriteInput>;
  terms<TResource = WordPressCategory>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): TermsResourceClient<TResource, QueryParams & PaginationParams, TermWriteInput, TermWriteInput>;
  terms<TResource = WordPressCategory>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): TermsResourceClient<TResource, QueryParams & PaginationParams, TermWriteInput, TermWriteInput> {
    return this.genericResourcesRegistry.terms(resource, responseSchema);
  }

  // ============= CROSS-RESOURCE SEARCH =============

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

  // ============= DISCOVERY API =============

  /**
   * Explores and catalogs all discoverable resources and abilities.
   * 
   * Discovery exposes JSON Schema shapes for upstream introspection,
   * AI/tool generation, and schema-aware integrations.
   * 
   * @example
   * ```typescript
   * // Discover everything
   * const catalog = await wp.explore();
   * 
   * // Force refresh
   * const fresh = await wp.explore({ refresh: true });
   * 
   * // Limit to specific kinds
   * const contentOnly = await wp.explore({ include: ['content'] });
   * ```
   */
  async explore(
    options?: WordPressDiscoveryOptions & WordPressRequestOverrides,
  ): Promise<WordPressDiscoveryCatalog> {
    return this.discoveryMethods.explore(options);
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
