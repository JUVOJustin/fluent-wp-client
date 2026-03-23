import type { WordPressPostBase } from '../schemas.js';
import type { WordPressRequestOverrides, PaginatedResponse, PaginationParams, QueryParams } from '../types/resources.js';
import type { WordPressWritePayload, DeleteOptions } from '../types/payloads.js';
import type { WordPressStandardSchema } from './validation.js';
import type { WordPressRuntime } from './transport.js';
import { ExecutableQuery } from './query-base.js';
import { createWordPressPaginator } from './pagination.js';
import { filterToParams, compactPayload, normalizeDeleteResult } from './params.js';
import { applyRequestOverrides } from './request-overrides.js';
import { throwIfWordPressError } from './errors.js';
import { validateWithStandardSchema } from './validation.js';
import { WordPressContentQuery } from '../content-query.js';
import type { WordPressBlockParser } from '../blocks.js';

/**
 * Dependencies required for resource operations.
 */
export interface ResourceContext {
  runtime: WordPressRuntime;
  endpoint: string;
}

/**
 * Base class for collection-based WordPress resources.
 * 
 * Provides shared implementations for:
 * - list (single page)
 * - listAll (all pages via pagination)
 * - listPaginated (with metadata)
 * - getById
 * - getBySlug
 */
export abstract class BaseCollectionResource<TResource, TFilter extends PaginationParams> {
  protected readonly runtime: WordPressRuntime;
  protected readonly endpoint: string;

  constructor(context: ResourceContext) {
    this.runtime = context.runtime;
    this.endpoint = context.endpoint;
  }

  /**
   * Normalizes filter before applying to requests.
   * Override in subclasses to add default filters.
   */
  protected normalizeFilter(filter: TFilter | Omit<TFilter, 'page'>): QueryParams {
    return filter as QueryParams;
  }

  /**
   * Creates a paginator for this resource.
   */
  protected createPaginator() {
    return createWordPressPaginator<TFilter, TResource>({
      fetchPage: (currentFilter, context) => {
        const params = filterToParams(this.normalizeFilter(currentFilter));
        return this.runtime.fetchAPIPaginated<TResource[]>(
          this.endpoint,
          params,
          context as WordPressRequestOverrides | undefined,
        );
      },
    });
  }

  /**
   * Lists one page of resources.
   */
  async list(filter: TFilter = {} as TFilter, options?: WordPressRequestOverrides): Promise<TResource[]> {
    const params = filterToParams(this.normalizeFilter(filter));
    return this.runtime.fetchAPI<TResource[]>(this.endpoint, params, options);
  }

  /**
   * Lists all resources using automatic pagination.
   */
  async listAll(
    filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<TResource[]> {
    return this.createPaginator().listAll(filter, options);
  }

  /**
   * Lists one page with pagination metadata.
   */
  async listPaginated(
    filter: TFilter = {} as TFilter,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TResource>> {
    return this.createPaginator().listPaginated(filter, options);
  }

  /**
   * Gets one resource by ID.
   */
  async getById(id: number, options?: WordPressRequestOverrides): Promise<TResource> {
    const params = filterToParams(this.normalizeFilter({} as Omit<TFilter, 'page'>));
    return this.runtime.fetchAPI<TResource>(`${this.endpoint}/${id}`, params, options);
  }

  /**
   * Gets one resource by slug.
   */
  async getBySlug(slug: string, options?: WordPressRequestOverrides): Promise<TResource | undefined> {
    const params = filterToParams(this.normalizeFilter({ slug } as unknown as TFilter));
    const items = await this.runtime.fetchAPI<TResource[]>(this.endpoint, params, options);
    return items[0];
  }
}

/**
 * Base class for resources with CRUD operations.
 * 
 * Extends BaseCollectionResource with create, update, and delete.
 */
export abstract class BaseCrudResource<
  TResource,
  TFilter extends PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> extends BaseCollectionResource<TResource, TFilter> {
  /**
   * Optional default response schema for validation.
   * Override in subclasses to provide default schema.
   */
  protected get defaultSchema(): WordPressStandardSchema<TResource> | undefined {
    return undefined;
  }

  /**
   * Resolves mutation arguments from overloaded signatures.
   */
  protected resolveMutationArguments<TResponse>(
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): {
    responseSchema?: WordPressStandardSchema<TResponse>;
    requestOptions?: WordPressRequestOverrides;
  } {
    if (responseSchemaOrRequestOptions && typeof responseSchemaOrRequestOptions === 'object' && '~standard' in responseSchemaOrRequestOptions) {
      return {
        responseSchema: responseSchemaOrRequestOptions as WordPressStandardSchema<TResponse>,
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
      requestOptions: { ...responseSchemaOrRequestOptions, ...requestOptions },
    };
  }

  /**
   * Executes a mutation request with optional schema validation.
   */
  protected async executeMutation<T>(
    options: Parameters<WordPressRuntime['request']>[0],
    responseSchema?: WordPressStandardSchema<T>,
  ): Promise<T> {
    const { data, response } = await this.runtime.request<unknown>(options);
    throwIfWordPressError(response, data);

    if (responseSchema) {
      return validateWithStandardSchema(responseSchema, data, 'WordPress mutation response validation failed');
    }

    return data as T;
  }

  /**
   * Creates a new resource.
   */
  async create<TResponse = TResource>(
    input: TCreate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    const resolved = this.resolveMutationArguments<TResponse>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TResponse>(
      applyRequestOverrides({
        endpoint: this.endpoint,
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (this.defaultSchema as WordPressStandardSchema<TResponse> | undefined),
    );
  }

  /**
   * Updates an existing resource.
   */
  async update<TResponse = TResource>(
    id: number,
    input: TUpdate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    const resolved = this.resolveMutationArguments<TResponse>(responseSchemaOrRequestOptions, requestOptions);

    return this.executeMutation<TResponse>(
      applyRequestOverrides({
        endpoint: `${this.endpoint}/${id}`,
        method: 'POST',
        body: compactPayload(input),
      }, resolved.requestOptions, 'Mutation helper options'),
      resolved.responseSchema ?? (this.defaultSchema as WordPressStandardSchema<TResponse> | undefined),
    );
  }

  /**
   * Deletes a resource.
   */
  async delete(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<{ id: number; deleted: boolean; previous?: unknown }> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: `${this.endpoint}/${id}`,
      method: 'DELETE',
      params,
    }, options, 'Mutation helper options'));

    return normalizeDeleteResult(id, data);
  }
}

/**
 * Configuration for post-like resources.
 */
export interface PostLikeResourceContext extends ResourceContext {
  missingRawMessage: string;
  defaultBlockParser?: WordPressBlockParser;
}

/**
 * Base class for post-like resources (posts, pages, custom post types).
 * 
 * Extends BaseCrudResource with:
 * - Content query builders for single items (with block parsing support)
 * - Default embedded content filter
 */
export abstract class BasePostLikeResource<
  TContent extends WordPressPostBase,
  TFilter extends QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> extends BaseCrudResource<TContent, TFilter, TCreate, TUpdate> {
  protected readonly missingRawMessage: string;
  protected readonly defaultBlockParser?: WordPressBlockParser;

  constructor(context: PostLikeResourceContext) {
    super(context);
    this.missingRawMessage = context.missingRawMessage;
    this.defaultBlockParser = context.defaultBlockParser;
  }

  /**
   * Default filter adds _embed for post-like resources.
   */
  protected override normalizeFilter(filter: TFilter | Omit<TFilter, 'page'>): QueryParams {
    return {
      ...filter,
      _embed: 'true',
    };
  }

  /**
   * Creates a content query for lazy block/content access.
   */
  protected createContentQuery<TResult extends TContent | undefined>(
    loadView: () => Promise<TResult>,
    loadEdit: () => Promise<TResult>,
  ): WordPressContentQuery<TResult> {
    return new WordPressContentQuery<TResult>(
      loadView,
      loadEdit,
      this.missingRawMessage,
      this.defaultBlockParser,
    );
  }

  /**
   * Gets one post by ID as a content query (supports .getBlocks(), .getContent()).
   */
  getByIdAsQuery(id: number, options?: WordPressRequestOverrides): WordPressContentQuery<TContent> {
    return this.createContentQuery<TContent>(
      () => this.runtime.fetchAPI<TContent>(`${this.endpoint}/${id}`, { _embed: 'true' }, options),
      () => this.runtime.fetchAPI<TContent>(`${this.endpoint}/${id}`, { _embed: 'true', context: 'edit' }, options),
    );
  }

  /**
   * Gets one post by slug as a content query.
   */
  getBySlugAsQuery(slug: string, options?: WordPressRequestOverrides): WordPressContentQuery<TContent | undefined> {
    return this.createContentQuery<TContent | undefined>(
      async () => {
        const params = { slug, _embed: 'true' };
        const items = await this.runtime.fetchAPI<TContent[]>(this.endpoint, params, options);
        return items[0];
      },
      async () => {
        const params = { slug, _embed: 'true', context: 'edit' };
        const items = await this.runtime.fetchAPI<TContent[]>(this.endpoint, params, options);
        return items[0];
      },
    );
  }
}
