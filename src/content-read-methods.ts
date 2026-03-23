import type { WordPressBlockParser } from './blocks.js';
import { WordPressContentQuery } from './content-query.js';
import type { WordPressPostBase } from './schemas.js';
import type { WordPressRequestOverrides } from './types/resources.js';
import { filterToParams } from './core/params.js';
import type { FetchResult, PaginatedResponse, PaginationParams, QueryParams, SerializedQueryParams } from './types/resources.js';
import { createWordPressPaginator } from './core/pagination.js';

/**
 * Runtime dependencies required for post-like resource read methods.
 */
export interface PostLikeReadMethodConfig<
  TContent extends WordPressPostBase,
  TFilter extends QueryParams & PaginationParams,
> {
  resource: string;
  missingRawMessage: string;
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>;
  fetchAPIPaginated: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>;
  defaultBlockParser?: WordPressBlockParser;
  withDefaultFilter?: (filter: TFilter | Omit<TFilter, 'page'> | (TFilter & PaginationParams)) => QueryParams;
}

/**
 * Shared read methods for post-like resources such as posts and pages.
 *
 * List methods return plain serializable DTO arrays. Single-item getters
 * return `WordPressContentQuery` instances with Gutenberg block helpers.
 */
export function createPostLikeReadMethods<
  TContent extends WordPressPostBase,
  TFilter extends QueryParams & PaginationParams,
>(config: PostLikeReadMethodConfig<TContent, TFilter>) {
  const withDefaultFilter = config.withDefaultFilter ?? ((filter) => ({ ...filter, _embed: 'true' }));
  const paginator = createWordPressPaginator<TFilter, TContent>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(withDefaultFilter(currentFilter));
      return config.fetchAPIPaginated<TContent[]>(
        `/${config.resource}`,
        params,
        context as WordPressRequestOverrides | undefined,
      );
    },
  });

  /**
   * Lists one page of post-like content with request-scoped transport overrides.
   */
  async function listWithOptions(
    filter: TFilter = {} as TFilter,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const params = filterToParams(withDefaultFilter(filter));
    return config.fetchAPI<TContent[]>(`/${config.resource}`, params, requestOptions);
  }


  /**
   * Lists all post-like content with request-scoped transport overrides.
   */
  async function listAllWithOptions(
    filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    return paginator.listAll(filter, requestOptions);
  }

  /**
   * Lists one page of post-like content with pagination metadata and request overrides.
   */
  async function listPaginatedWithOptions(
    filter: TFilter = {} as TFilter,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TContent>> {
    return paginator.listPaginated(filter, requestOptions);
  }

  /**
   * Gets one post-like record by numeric ID as a content query with block helpers.
   */
  function getById(id: number, requestOptions?: WordPressRequestOverrides): WordPressContentQuery<TContent> {
    return new WordPressContentQuery<TContent>(
      () => config.fetchAPI<TContent>(`/${config.resource}/${id}`, { _embed: 'true' }, requestOptions),
      () => config.fetchAPI<TContent>(`/${config.resource}/${id}`, { _embed: 'true', context: 'edit' }, requestOptions),
      config.missingRawMessage,
      config.defaultBlockParser,
    );
  }

  /**
   * Gets one post-like record by slug as a content query with block helpers.
   */
  function getBySlug(
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): WordPressContentQuery<TContent | undefined> {
    return new WordPressContentQuery<TContent | undefined>(
      async () => {
        const items = await config.fetchAPI<TContent[]>(`/${config.resource}`, { slug, _embed: 'true' }, requestOptions);
        return items[0];
      },
      async () => {
        const items = await config.fetchAPI<TContent[]>(
          `/${config.resource}`,
          { slug, _embed: 'true', context: 'edit' },
          requestOptions,
        );
        return items[0];
      },
      config.missingRawMessage,
      config.defaultBlockParser,
    );
  }

  return {
    list: listWithOptions,
    listAll: listAllWithOptions,
    listPaginated: listPaginatedWithOptions,
    getById,
    getBySlug,
  };
}
