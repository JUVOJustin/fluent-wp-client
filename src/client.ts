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
import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressComment,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressPostLike,
  WordPressPostWriteBase,
  WordPressSearchResult,
  WordPressSettings,
  WordPressTag,
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
  WordPressRequestOverrides as _Overrides,
} from './types/resources.js';
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
 * // Single-item queries are awaitable and expose raw content helpers
 * const post = await posts.item(123);
 * const content = await posts.item(123).getContent();
 *
 * // Embed related data with selective or full embed
 * const postWithAuthor = await posts.item(123, { embed: ['author', 'wp:term'] });
 * const postWithAll = await posts.item(123, { embed: true });
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
      onRequest: config.onRequest,
    });

    // Create runtime interface
    this.runtime = createRuntime(this.transport);

    // Initialize resource instances
    this.mediaResource = MediaResource.create(this.runtime);
    this.usersResource = UsersResource.create(this.runtime);
    this.settingsResource = SettingsResource.create(this.runtime);
    this.commentsResource = CommentsResource.create(this.runtime);
    this.discoveryMethods = createDiscoveryMethods(this.runtime);

    this.genericResourcesRegistry = new GenericResourceRegistry({
      runtime: this.runtime,
      discoveryMethods: this.discoveryMethods,
    });
    this.abilityMethods = createAbilityMethods({
      fetchAPI: this.runtime.fetchAPI.bind(this.runtime),
      request: this.runtime.request.bind(this.runtime),
      describeAbility: (name, options) => this.discoveryMethods.describeAbility(name, options),
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
   * Returns the internal runtime interface for use by add-on subpackages.
   */
  getRuntime(): WordPressRuntime {
    return this.runtime;
  }

  /**
   * Executes one low-level WordPress request.
   */
  request<T = unknown>(options: WordPressRequestOptions): Promise<WordPressRequestResult<T>> {
    return this.runtime.request(options);
  }

  // ============= FIRST-CLASS RESOURCE API =============

  media(): MediaResourceClient<WordPressMedia, ExtensibleFilter<MediaFilter>, WordPressWritePayload, WordPressWritePayload> {
    return createMediaClient(this.mediaResource, (options) =>
      this.discoveryMethods.describeResource('media', options),
    );
  }

  comments(): CommentsResourceClient<WordPressComment, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload> {
    return createCommentsClient(this.commentsResource, (options) =>
      this.discoveryMethods.describeResource('comments', options),
    );
  }

  users(): UsersResourceClient<WordPressAuthor, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput> {
    return createUsersClient(this.usersResource, (options) =>
      this.discoveryMethods.describeResource('users', options),
    );
  }

  settings(): SettingsResourceClient<WordPressSettings> {
    return createSettingsClient(this.settingsResource, (options) =>
      this.discoveryMethods.describeResource('settings', options),
    );
  }

  // ============= GENERIC CONTENT API =============

  content(
    resource: 'posts',
  ): ContentResourceClient<WordPressPost, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content(
    resource: 'pages',
  ): ContentResourceClient<WordPressPage, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
  ): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload>;
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
  ): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
    return this.genericResourcesRegistry.content(resource);
  }

  // ============= GENERIC TERMS API =============

  terms(
    resource: 'categories',
  ): TermsResourceClient<WordPressCategory, ExtensibleFilter<CategoriesFilter>, TermWriteInput, TermWriteInput>;
  terms(
    resource: 'tags',
  ): TermsResourceClient<WordPressTag, ExtensibleFilter<TagsFilter>, TermWriteInput, TermWriteInput>;
  terms<TResource = WordPressCategory>(
    resource: string,
  ): TermsResourceClient<TResource, QueryParams & PaginationParams, TermWriteInput, TermWriteInput>;
  terms<TResource = WordPressCategory>(
    resource: string,
  ): TermsResourceClient<TResource, QueryParams & PaginationParams, TermWriteInput, TermWriteInput> {
    return this.genericResourcesRegistry.terms(resource);
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
   * Starts a fluent REST ability builder.
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
    options?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return this.abilityMethods.executeGetAbility(name, input, options);
  }

  /**
   * Executes one regular ability through POST /run.
   */
  async executeRunAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    options?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return this.abilityMethods.executeRunAbility(name, input, options);
  }

  /**
   * Executes one destructive ability through DELETE /run.
   */
  async executeDeleteAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    options?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return this.abilityMethods.executeDeleteAbility(name, input, options);
  }

  // ============= DISCOVERY API =============

  /**
   * Seeds the internal discovery cache from an externally supplied catalog.
   *
   * Enables a "explore once, store anywhere, restore later" pattern so
   * expensive `OPTIONS` discovery requests are only made when needed:
   *
   * ```typescript
   * // First run: explore and persist
   * const catalog = await wp.explore();
   * await kv.set('wp:catalog', JSON.stringify(catalog));
   *
   * // Subsequent runs: restore from storage
   * const stored = JSON.parse(await kv.get('wp:catalog') ?? 'null');
   * if (stored) wp.useCatalog(stored);
   *
   * // describe() now uses the seeded cache — no network round-trip needed
   * const desc = await wp.content('pages').describe();
   * console.log(desc.capabilities.queryParams); // ['page', 'per_page', 'lang', ...]
   * ```
   *
   * Returns `this` so the call can be chained after construction.
   */
  useCatalog(catalog: WordPressDiscoveryCatalog): this {
    this.discoveryMethods.seedCatalog(catalog);
    return this;
  }

  /**
   * Returns the currently cached discovery catalog snapshot when available.
   *
   * This is synchronous and never performs network discovery. It returns the
   * full cached catalog when one exists, or a partial snapshot assembled from
   * previously described resources and abilities.
   */
  getCachedCatalog(): WordPressDiscoveryCatalog | undefined {
    return this.discoveryMethods.getCatalogSnapshot();
  }

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
    return this.transport.loginWithJwt(credentials, options);
  }

  /**
   * Validates one JWT token with the WP JWT plugin endpoint.
   */
  async validateJwtToken(
    token?: string | JwtAuthCredentials,
    options?: WordPressRequestOverrides,
  ): Promise<JwtAuthValidationResponse> {
    return this.transport.validateJwtToken(token, options);
  }
}
