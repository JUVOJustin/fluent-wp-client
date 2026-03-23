import type { WordPressContentQuery } from '../content-query.js';
import type { WordPressBlockParser } from '../blocks.js';
import type { WordPressPostBase } from '../schemas.js';
import type { WordPressRequestOptions, WordPressRequestResult } from '../types/client.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type { FetchResult, PaginationParams, QueryParams, SerializedQueryParams, WordPressDeleteResult, PaginatedResponse } from '../types/resources.js';
import type { DeleteOptions, WordPressWritePayload } from '../types/payloads.js';
import { createPostLikeReadMethods } from './post-like-read-factory.js';
import { createWordPressPaginator } from './pagination.js';
import { filterToParams } from './params.js';
import { applyRequestOverrides } from './request-overrides.js';
import { compactPayload, normalizeDeleteResult } from './params.js';

/**
 * Dependencies required for read-only resource methods.
 */
export interface ReadDependencies {
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>;
  fetchAPIPaginated: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>;
}

/**
 * Dependencies required for CRUD mutation methods.
 */
export interface MutationDependencies {
  executeMutation: <T>(options: WordPressRequestOptions, responseSchema?: WordPressStandardSchema<T>) => Promise<T>;
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
}

/**
 * Unified dependencies for a complete resource with both read and CRUD operations.
 */
export interface ResourceDependencies extends ReadDependencies, MutationDependencies {}

/**
 * Generic CRUD method signatures.
 */
export interface CrudMethods<
  TResource,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  create<TResponse = TResource>(
    input: TCreate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse>;
  update<TResponse = TResource>(
    id: number,
    input: TUpdate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse>;
  delete(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult>;
}

/**
 * Generic collection read method signatures.
 */
export interface CollectionReadMethods<TResource, TFilter extends PaginationParams> {
  list(filter?: TFilter, options?: WordPressRequestOverrides): Promise<TResource[]>;
  listAll(filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides): Promise<TResource[]>;
  listPaginated(filter?: TFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<TResource>>;
  getById(id: number, options?: WordPressRequestOverrides): Promise<TResource>;
  getBySlug(slug: string, options?: WordPressRequestOverrides): Promise<TResource | undefined>;
}

/**
 * Post-like read method signatures.
 */
export interface PostLikeReadMethods<TContent extends WordPressPostBase, TFilter extends QueryParams & PaginationParams> {
  list(filter?: TFilter, options?: WordPressRequestOverrides): Promise<TContent[]>;
  listAll(filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides): Promise<TContent[]>;
  listPaginated(filter?: TFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<TContent>>;
  getById(id: number, options?: WordPressRequestOverrides): WordPressContentQuery<TContent>;
  getBySlug(slug: string, options?: WordPressRequestOverrides): WordPressContentQuery<TContent | undefined>;
}

/**
 * Normalizes one collection filter before serialization.
 */
export type CollectionFilterResolver<TFilter extends PaginationParams> = (
  filter: TFilter | Omit<TFilter, 'page'>,
) => QueryParams;

/**
 * Helper to resolve overloaded mutation arguments.
 */
export function resolveMutationArguments<TResponse>(
  responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
  requestOptions?: WordPressRequestOverrides,
): {
  responseSchema?: WordPressStandardSchema<TResponse>;
  requestOptions?: WordPressRequestOverrides;
} {
  if (responseSchemaOrRequestOptions && typeof responseSchemaOrRequestOptions === 'object' && '~standard' in responseSchemaOrRequestOptions) {
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
    requestOptions: { ...responseSchemaOrRequestOptions, ...requestOptions },
  };
}

/**
 * Creates a factory function that returns typed collection read methods
 * for any simple WordPress REST resource.
 *
 * Eliminates the repetitive boilerplate in media, categories, tags, users,
 * and comments resource factories.
 */
export function createCollectionResourceFactory<TResource, TFilter extends PaginationParams>(
  endpoint: string,
  withDefaultFilter?: CollectionFilterResolver<TFilter>,
) {
  return function createResourceMethods(
    dependencies: ReadDependencies,
  ): CollectionReadMethods<TResource, TFilter> {
    const core = createCollectionReadMethods<TResource, TFilter>({
      endpoint,
      withDefaultFilter,
      ...dependencies,
    });

    return core;
  };
}

/**
 * Creates CRUD methods for a collection resource.
 */
export function createCollectionCrudFactory<
  TResource,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
>(
  endpoint: string,
  defaultSchema?: WordPressStandardSchema<TResource>,
) {
  return function createCrudMethods(deps: MutationDependencies): CrudMethods<TResource, TCreate, TUpdate> {
    return {
      async create<TResponse = TResource>(
        input: TCreate,
        responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
        requestOptions?: WordPressRequestOverrides,
      ): Promise<TResponse> {
        const resolved = resolveMutationArguments<TResponse>(responseSchemaOrRequestOptions, requestOptions);

        return deps.executeMutation<TResponse>(
          applyRequestOverrides({
            endpoint,
            method: 'POST',
            body: compactPayload(input),
          }, resolved.requestOptions, 'Mutation helper options'),
          resolved.responseSchema ?? (defaultSchema as WordPressStandardSchema<TResponse> | undefined),
        );
      },

      async update<TResponse = TResource>(
        id: number,
        input: TUpdate,
        responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
        requestOptions?: WordPressRequestOverrides,
      ): Promise<TResponse> {
        const resolved = resolveMutationArguments<TResponse>(responseSchemaOrRequestOptions, requestOptions);

        return deps.executeMutation<TResponse>(
          applyRequestOverrides({
            endpoint: `${endpoint}/${id}`,
            method: 'POST',
            body: compactPayload(input),
          }, resolved.requestOptions, 'Mutation helper options'),
          resolved.responseSchema ?? (defaultSchema as WordPressStandardSchema<TResponse> | undefined),
        );
      },

      async delete(id: number, options: DeleteOptions & WordPressRequestOverrides = {}): Promise<WordPressDeleteResult> {
        const params = options.force ? { force: 'true' } : undefined;
        const { data } = await deps.request<unknown>(applyRequestOverrides({
          endpoint: `${endpoint}/${id}`,
          method: 'DELETE',
          params,
        }, options, 'Mutation helper options'));

        return normalizeDeleteResult(id, data);
      },
    };
  };
}

/**
 * Creates a factory function that returns post-like read methods
 * for post-like WordPress REST resources.
 *
 * Eliminates the repetitive boilerplate in posts and pages resource
 * factories. Each resource exports the result of calling this factory
 * with its configuration.
 */
export function createPostLikeResourceFactory<TContent extends WordPressPostBase, TFilter extends QueryParams & PaginationParams>(
  resource: string,
  missingRawMessage: string,
  withDefaultFilter?: (filter: TFilter | Omit<TFilter, 'page'> | (TFilter & PaginationParams)) => QueryParams,
) {
  return function createResourceMethods(
    dependencies: ReadDependencies,
    defaultBlockParser?: WordPressBlockParser,
  ): PostLikeReadMethods<TContent, TFilter> {
    const core = createPostLikeReadMethods<TContent, TFilter>({
      resource,
      missingRawMessage,
      ...dependencies,
      defaultBlockParser,
      withDefaultFilter,
    });

    return core;
  };
}

/**
 * Runtime dependencies required for post-like resource read methods.
 */
export interface PostLikeReadMethodConfig<
  TContent extends WordPressPostBase,
  TFilter extends QueryParams & PaginationParams,
> extends ReadDependencies {
  resource: string;
  missingRawMessage: string;
  defaultBlockParser?: WordPressBlockParser;
  withDefaultFilter?: (filter: TFilter | Omit<TFilter, 'page'> | (TFilter & PaginationParams)) => QueryParams;
}

/**
 * Dependencies for a simple collection read methods group.
 */
interface CollectionReadMethodsConfig<TResource, TFilter extends PaginationParams> extends ReadDependencies {
  /** REST endpoint path, e.g. `/categories`. */
  endpoint: string;
  withDefaultFilter?: CollectionFilterResolver<TFilter>;
}

/**
 * Creates the shared list, listAll, listPaginated, getById, and getBySlug methods
 * for any simple WordPress collection endpoint.
 *
 * Eliminates the repeated paginator setup and identical method bodies present in
 * every resource-specific factory (categories, tags, users, comments, media).
 * Each resource factory calls this function and re-exports the methods under its
 * own resource-specific names.
 */
function createCollectionReadMethods<TResource, TFilter extends PaginationParams>(
  config: CollectionReadMethodsConfig<TResource, TFilter>,
): CollectionReadMethods<TResource, TFilter> {
  const withDefaultFilter = config.withDefaultFilter ?? ((filter) => filter as QueryParams);
  const paginator = createWordPressPaginator<TFilter, TResource>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(withDefaultFilter(currentFilter));
      return config.fetchAPIPaginated<TResource[]>(
        config.endpoint,
        params,
        context as WordPressRequestOverrides | undefined,
      );
    },
  });

  return {
    /** Lists resources matching the given filter. */
    list(filter: TFilter = {} as TFilter, options?: WordPressRequestOverrides): Promise<TResource[]> {
      const params = filterToParams(withDefaultFilter(filter));
      return config.fetchAPI<TResource[]>(config.endpoint, params, options);
    },

    /** Fetches every resource by paginating all available pages. */
    listAll(
      filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
      options?: WordPressRequestOverrides,
    ): Promise<TResource[]> {
      return paginator.listAll(filter, options);
    },

    /** Lists resources with pagination metadata. */
    listPaginated(
      filter: TFilter = {} as TFilter,
      options?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<TResource>> {
      return paginator.listPaginated(filter, options);
    },

    /** Fetches one resource by numeric ID. */
    getById(id: number, options?: WordPressRequestOverrides): Promise<TResource> {
      const params = filterToParams(withDefaultFilter({} as Omit<TFilter, 'page'>));
      return config.fetchAPI<TResource>(`${config.endpoint}/${id}`, params, options);
    },

    /** Fetches one resource by slug, returning undefined when not found. */
    getBySlug(slug: string, options?: WordPressRequestOverrides): Promise<TResource | undefined> {
      const params = filterToParams(withDefaultFilter({ slug } as unknown as TFilter));
      return config
        .fetchAPI<TResource[]>(config.endpoint, params, options)
        .then((items) => items[0]);
    },
  };
}
