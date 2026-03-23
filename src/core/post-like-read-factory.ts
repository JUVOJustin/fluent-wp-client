import { WordPressContentQuery } from '../content-query.js';
import type { WordPressPostBase } from '../schemas.js';
import type {
  PostLikeReadMethodConfig,
  PostLikeReadMethods,
} from './resource-factories.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import { filterToParams } from './params.js';
import type { PaginatedResponse, PaginationParams, QueryParams, SerializedQueryParams } from '../types/resources.js';
import { createWordPressPaginator } from './pagination.js';

/**
 * Shared read methods for post-like resources such as posts and pages.
 *
 * List methods return plain serializable DTO arrays. Single-item getters
 * return `WordPressContentQuery` instances with Gutenberg block helpers.
 */
export function createPostLikeReadMethods<
  TContent extends WordPressPostBase,
  TFilter extends QueryParams & PaginationParams,
>(config: PostLikeReadMethodConfig<TContent, TFilter>): PostLikeReadMethods<TContent, TFilter> {
  const endpoint = `/${config.resource}`;
  const withDefaultFilter = config.withDefaultFilter ?? ((filter) => ({ ...filter, _embed: 'true' }));
  const paginator = createWordPressPaginator<TFilter, TContent>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(withDefaultFilter(currentFilter));
      return config.fetchAPIPaginated<TContent[]>(
        endpoint,
        params,
        context as WordPressRequestOverrides | undefined,
      );
    },
  });

  /**
   * Creates one content query with shared fallback messaging and block parsing.
   */
  function createContentQuery<TResult extends TContent | undefined>(
    loadPublished: () => Promise<TResult>,
    loadEditable: () => Promise<TResult>,
  ): WordPressContentQuery<TResult> {
    return new WordPressContentQuery<TResult>(
      loadPublished,
      loadEditable,
      config.missingRawMessage,
      config.defaultBlockParser,
    );
  }

  /**
   * Fetches one post-like item by slug and returns the first REST match.
   */
  async function fetchBySlug(
    slug: string,
    requestOptions?: WordPressRequestOverrides,
    context?: 'edit',
  ): Promise<TContent | undefined> {
    const params: SerializedQueryParams = { slug, _embed: 'true' };

    if (context) {
      params.context = context;
    }

    const items = await config.fetchAPI<TContent[]>(endpoint, params, requestOptions);
    return items[0];
  }

  /**
   * Lists one page of post-like content with request-scoped transport overrides.
   */
  async function listWithOptions(
    filter: TFilter = {} as TFilter,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const params = filterToParams(withDefaultFilter(filter));
    return config.fetchAPI<TContent[]>(endpoint, params, requestOptions);
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
    return createContentQuery<TContent>(
      () => config.fetchAPI<TContent>(`${endpoint}/${id}`, { _embed: 'true' }, requestOptions),
      () => config.fetchAPI<TContent>(`${endpoint}/${id}`, { _embed: 'true', context: 'edit' }, requestOptions),
    );
  }

  /**
   * Gets one post-like record by slug as a content query with block helpers.
   */
  function getBySlug(
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): WordPressContentQuery<TContent | undefined> {
    return createContentQuery<TContent | undefined>(
      () => fetchBySlug(slug, requestOptions),
      () => fetchBySlug(slug, requestOptions, 'edit'),
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
