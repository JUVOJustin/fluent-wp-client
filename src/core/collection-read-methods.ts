import type { WordPressRequestOverrides } from '../client-types.js';
import type { FetchResult, PaginatedResponse, PaginationParams, QueryParams, SerializedQueryParams } from '../types/resources.js';
import { createWordPressPaginator } from './pagination.js';
import { filterToParams } from './params.js';

/**
 * Dependencies for a simple collection read methods group.
 */
export interface CollectionReadMethodsConfig<TResource, TFilter extends PaginationParams> {
  /** REST endpoint path, e.g. `/categories`. */
  endpoint: string;
  fetchAPI: <T>(
    endpoint: string,
    params?: SerializedQueryParams,
    options?: WordPressRequestOverrides,
  ) => Promise<T>;
  fetchAPIPaginated: <T>(
    endpoint: string,
    params?: SerializedQueryParams,
    options?: WordPressRequestOverrides,
  ) => Promise<FetchResult<T>>;
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
export function createCollectionReadMethods<TResource, TFilter extends PaginationParams>(
  config: CollectionReadMethodsConfig<TResource, TFilter>,
) {
  const paginator = createWordPressPaginator<TFilter, TResource>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(currentFilter as unknown as QueryParams);
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
      const params = filterToParams(filter as unknown as QueryParams);
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
      return config.fetchAPI<TResource>(`${config.endpoint}/${id}`, undefined, options);
    },

    /** Fetches one resource by slug, returning undefined when not found. */
    getBySlug(slug: string, options?: WordPressRequestOverrides): Promise<TResource | undefined> {
      return config
        .fetchAPI<TResource[]>(config.endpoint, { slug }, options)
        .then((items) => items[0]);
    },
  };
}
