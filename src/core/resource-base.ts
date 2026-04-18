import type { WordPressPostBase } from "../schemas.js";
import type {
  DeleteOptions,
  WordPressWritePayload,
} from "../types/payloads.js";
import type {
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  WordPressDeleteResult,
  WordPressRequestOverrides,
} from "../types/resources.js";
import { createWordPressPaginator, type ListAllOptions } from "./pagination.js";
import {
  compactPayload,
  filterToParams,
  normalizeDeleteResult,
  resolveEmbedQueryParams,
} from "./params.js";
import { applyRequestOverrides } from "./request-overrides.js";
import type { WordPressRuntime } from "./transport.js";

/**
 * Dependencies required for resource operations.
 */
export interface ResourceContext {
  endpoint: string;
  runtime: WordPressRuntime;
}

/**
 * Shared CRUD resource context.
 */
export type CrudResourceContext = ResourceContext;

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
export abstract class BaseCollectionResource<
  TResource,
  TFilter extends PaginationParams,
> {
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
  protected normalizeFilter(
    filter: TFilter | Omit<TFilter, "page">,
  ): QueryParams {
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
  async list(
    filter: TFilter = {} as TFilter,
    options?: WordPressRequestOverrides,
  ): Promise<TResource[]> {
    const params = filterToParams(this.normalizeFilter(filter));
    return this.runtime.fetchAPI<TResource[]>(this.endpoint, params, options);
  }

  /**
   * Lists all resources using automatic pagination with parallel fetching.
   */
  async listAll(
    filter: Omit<TFilter, "page"> = {} as Omit<TFilter, "page">,
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
  async getById(
    id: number,
    options?: WordPressRequestOverrides,
  ): Promise<TResource> {
    const params = filterToParams(
      this.normalizeFilter({} as Omit<TFilter, "page">),
    );
    return this.runtime.fetchAPI<TResource>(
      `${this.endpoint}/${id}`,
      params,
      options,
    );
  }

  /**
   * Gets one resource by slug.
   */
  async getBySlug(
    slug: string,
    options?: WordPressRequestOverrides,
  ): Promise<TResource | undefined> {
    const params = filterToParams(
      this.normalizeFilter({ slug } as unknown as TFilter),
    );
    const items = await this.runtime.fetchAPI<TResource[]>(
      this.endpoint,
      params,
      options,
    );
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
  constructor(context: CrudResourceContext) {
    super(context);
  }

  /**
   * Executes a mutation request and returns the parsed response data.
   * Transport-level error handling (non-2xx, network, parse) is automatic.
   */
  protected async executeMutation<T = TResource>(
    options: Parameters<WordPressRuntime["request"]>[0],
  ): Promise<T> {
    const { data } = await this.runtime.request<unknown>(options);
    return data as T;
  }

  /**
   * Executes one create or update mutation.
   */
  protected mutate(
    endpoint: string,
    input: TCreate | TUpdate,
    options?: WordPressRequestOverrides,
  ): Promise<TResource> {
    return this.executeMutation<TResource>(
      applyRequestOverrides(
        {
          body: compactPayload(input),
          endpoint,
          method: "POST",
        },
        options,
      ),
    );
  }

  /**
   * Creates a new resource.
   */
  async create(
    input: TCreate,
    options?: WordPressRequestOverrides,
  ): Promise<TResource> {
    return this.mutate(this.endpoint, input, options);
  }

  /**
   * Updates an existing resource.
   */
  async update(
    id: number,
    input: TUpdate,
    options?: WordPressRequestOverrides,
  ): Promise<TResource> {
    return this.mutate(`${this.endpoint}/${id}`, input, options);
  }

  /**
   * Deletes a resource.
   */
  async delete(
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: "true" } : undefined;
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          endpoint: `${this.endpoint}/${id}`,
          method: "DELETE",
          params,
        },
        options,
      ),
    );

    return normalizeDeleteResult(id, data);
  }
}

/**
 * Configuration for post-like resources.
 */
export interface PostLikeResourceContext<
  TContent extends WordPressPostBase = WordPressPostBase,
> extends CrudResourceContext {
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
  protected override normalizeFilter(
    filter: TFilter | Omit<TFilter, "page">,
  ): QueryParams {
    return resolveEmbedQueryParams(filter as QueryParams);
  }

  /**
   * Fetches one post-like record by ID in view or edit context.
   */
  protected fetchContentById(
    id: number,
    options?: WordPressRequestOverrides,
    context?: "edit",
    embed: boolean | string[] = false,
    fields?: string[],
  ): Promise<TContent> {
    const params = filterToParams(
      resolveEmbedQueryParams(
        context ? { context, embed, fields } : { embed, fields },
      ),
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
    context?: "edit",
    embed: boolean | string[] = false,
    fields?: string[],
  ): Promise<TContent | undefined> {
    const params = filterToParams(
      resolveEmbedQueryParams(
        context ? { context, embed, fields, slug } : { embed, fields, slug },
      ),
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
