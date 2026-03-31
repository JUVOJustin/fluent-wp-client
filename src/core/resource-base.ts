import type { WordPressPostBase } from '../schemas.js';
import type {
  WordPressRequestOverrides,
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  WordPressDeleteResult,
} from '../types/resources.js';
import type { WordPressWritePayload, DeleteOptions } from '../types/payloads.js';
import type { WordPressStandardSchema } from './validation.js';
import type { WordPressRuntime } from './transport.js';
import { createWordPressPaginator, type ListAllOptions } from './pagination.js';
import {
  filterToParams,
  compactPayload,
  normalizeDeleteResult,
  resolveEmbedQueryParams,
} from './params.js';
import { applyRequestOverrides } from './request-overrides.js';
import { throwIfWordPressError } from './errors.js';
import { validateWithStandardSchema } from './validation.js';
import { resolveMutationArguments, type MutationOptions } from './mutation-helpers.js';

/**
 * Dependencies required for resource operations.
 */
export interface ResourceContext {
  runtime: WordPressRuntime;
  endpoint: string;
}

/**
 * Shared CRUD resource context with optional default mutation validation.
 */
export interface CrudResourceContext<TResource> extends ResourceContext {
  defaultSchema?: WordPressStandardSchema<TResource>;
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
   * Lists all resources using automatic pagination with parallel fetching.
   */
  async listAll(
    filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ): Promise<TResource[]> {
    return this.createPaginator().listAll(filter, options, listOptions);
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
  protected readonly defaultSchema?: WordPressStandardSchema<TResource>;

  constructor(context: CrudResourceContext<TResource>) {
    super(context);
    this.defaultSchema = context.defaultSchema;
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
   * Executes one create or update mutation with shared request/schema handling.
   *
   * When the resolved options include an `inputSchema`, the input is validated
   * and transformed before the HTTP request. Invalid input throws a
   * `WordPressSchemaValidationError` without making the request.
   */
  protected async mutate<TResponse>(
    endpoint: string,
    input: TCreate | TUpdate,
    mutationOptionsOrResponseSchema?: MutationOptions<TCreate | TUpdate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    const resolved = resolveMutationArguments<TResponse, TCreate | TUpdate>(
      mutationOptionsOrResponseSchema,
      requestOptions,
    );

    // Validate and transform input before making the HTTP request
    const body = resolved.inputSchema
      ? await validateWithStandardSchema(resolved.inputSchema, input, 'WordPress mutation input validation failed')
      : input;

    return this.executeMutation<TResponse>(
      applyRequestOverrides({
        endpoint,
        method: 'POST',
        body: compactPayload(body as TCreate | TUpdate),
      }, resolved.requestOptions),
      resolved.responseSchema ?? (this.defaultSchema as WordPressStandardSchema<TResponse> | undefined),
    );
  }

  /**
   * Creates a new resource.
   *
   * Accepts an optional `MutationOptions` object as the second parameter to
   * provide both `inputSchema` (validates the input before the request) and
   * `responseSchema` (validates the server response). For backward compatibility,
   * a bare Standard Schema or request overrides object are also accepted.
   */
  async create<TResponse = TResource>(
    input: TCreate,
    mutationOptionsOrResponseSchema?: MutationOptions<TCreate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    return this.mutate(
      this.endpoint,
      input,
      mutationOptionsOrResponseSchema,
      requestOptions,
    );
  }

  /**
   * Updates an existing resource.
   *
   * Accepts an optional `MutationOptions` object as the third parameter to
   * provide both `inputSchema` (validates the input before the request) and
   * `responseSchema` (validates the server response). For backward compatibility,
   * a bare Standard Schema or request overrides object are also accepted.
   */
  async update<TResponse = TResource>(
    id: number,
    input: TUpdate,
    mutationOptionsOrResponseSchema?: MutationOptions<TUpdate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse> {
    return this.mutate(
      `${this.endpoint}/${id}`,
      input,
      mutationOptionsOrResponseSchema,
      requestOptions,
    );
  }

  /**
   * Deletes a resource.
   */
  async delete(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: `${this.endpoint}/${id}`,
      method: 'DELETE',
      params,
    }, options));

    throwIfWordPressError(response, data);
    return normalizeDeleteResult(id, data);
  }
}

/**
 * Configuration for post-like resources.
 */
export interface PostLikeResourceContext<TContent extends WordPressPostBase = WordPressPostBase>
  extends CrudResourceContext<TContent> {
  missingRawMessage: string;
}

/**
 * Base class for post-like resources (posts, pages, custom post types).
 * 
 * Extends BaseCrudResource with:
 * - Content query builders for single items with edit-context raw content access
 * - Opt-in `_embed` handling for collection filters
 */
export abstract class BasePostLikeResource<
  TContent extends WordPressPostBase,
  TFilter extends QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> extends BaseCrudResource<TContent, TFilter, TCreate, TUpdate> {
  protected readonly missingRawMessage: string;

  constructor(context: PostLikeResourceContext<TContent>) {
    super(context);
    this.missingRawMessage = context.missingRawMessage;
  }

  /**
   * Normalizes public `embed` filters for post-like resources.
   */
  protected override normalizeFilter(filter: TFilter | Omit<TFilter, 'page'>): QueryParams {
    return resolveEmbedQueryParams(filter as QueryParams);
  }

  /**
   * Fetches one post-like record by ID in view or edit context.
   */
  protected fetchContentById(
    id: number,
    options?: WordPressRequestOverrides,
    context?: 'edit',
    embed = false,
    fields?: string[],
  ): Promise<TContent> {
    const params = filterToParams(
      resolveEmbedQueryParams(context ? { context, embed, fields } : { embed, fields }),
      { applyPerPageDefault: false },
    );

    return this.runtime.fetchAPI<TContent>(
      `${this.endpoint}/${id}`,
      params,
      options,
    );
  }

  /**
   * Fetches the first post-like record matching one slug in view or edit context.
   */
  protected async fetchContentBySlug(
    slug: string,
    options?: WordPressRequestOverrides,
    context?: 'edit',
    embed = false,
    fields?: string[],
  ): Promise<TContent | undefined> {
    const params = filterToParams(
      resolveEmbedQueryParams(context ? { slug, context, embed, fields } : { slug, embed, fields }),
      { applyPerPageDefault: false },
    );

    const items = await this.runtime.fetchAPI<TContent[]>(
      this.endpoint,
      params,
      options,
    );

    return items[0];
  }

}
