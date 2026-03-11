import type { WordPressBlockParser } from './blocks.js';
import { WordPressContentQuery } from './content-query.js';
import type { WordPressPostBase } from './schemas.js';
import { filterToParams } from './core/params.js';
import type { FetchResult, PaginatedResponse, PaginationParams } from './types/resources.js';
import { createWordPressPaginator } from './core/pagination.js';

/**
 * Runtime dependencies required for post-like resource read methods.
 */
export interface PostLikeReadMethodConfig<
  TContent extends WordPressPostBase,
  TFilter extends PaginationParams,
> {
  resource: string;
  missingRawMessage: string;
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>;
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>;
  defaultBlockParser?: WordPressBlockParser;
  withDefaultFilter?: (filter: TFilter | Omit<TFilter, 'page'> | (TFilter & PaginationParams)) => Record<string, unknown>;
}

/**
 * Shared read methods for post-like resources such as posts and pages.
 *
 * List methods return plain serializable DTO arrays. Single-item getters
 * return `WordPressContentQuery` instances with Gutenberg block helpers.
 */
export function createPostLikeReadMethods<
  TContent extends WordPressPostBase,
  TFilter extends PaginationParams,
>(config: PostLikeReadMethodConfig<TContent, TFilter>) {
  const withDefaultFilter = config.withDefaultFilter ?? ((filter) => ({ ...filter, _embed: 'true' }));
  const paginator = createWordPressPaginator<TFilter, TContent>({
    fetchPage: (filter) => {
      const params = filterToParams(withDefaultFilter(filter));
      return config.fetchAPIPaginated<TContent[]>(`/${config.resource}`, params);
    },
  });

  /**
   * Lists one page of post-like content as plain serializable DTOs.
   */
  async function list(filter: TFilter = {} as TFilter): Promise<TContent[]> {
    const params = filterToParams(withDefaultFilter(filter));
    return config.fetchAPI<TContent[]>(`/${config.resource}`, params);
  }

  /**
   * Lists all post-like content as plain serializable DTOs by paging through every page.
   */
  async function listAll(filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>): Promise<TContent[]> {
    return paginator.listAll(filter);
  }

  /**
   * Lists one page of post-like content as plain serializable DTOs with pagination metadata.
   */
  async function listPaginated(filter: TFilter = {} as TFilter): Promise<PaginatedResponse<TContent>> {
    return paginator.listPaginated(filter);
  }

  /**
   * Gets one post-like record by numeric ID as a content query with block helpers.
   */
  function getById(id: number): WordPressContentQuery<TContent> {
    return new WordPressContentQuery<TContent>(
      () => config.fetchAPI<TContent>(`/${config.resource}/${id}`, { _embed: 'true' }),
      () => config.fetchAPI<TContent>(`/${config.resource}/${id}`, { _embed: 'true', context: 'edit' }),
      config.missingRawMessage,
      config.defaultBlockParser,
    );
  }

  /**
   * Gets one post-like record by slug as a content query with block helpers.
   */
  function getBySlug(slug: string): WordPressContentQuery<TContent | undefined> {
    return new WordPressContentQuery<TContent | undefined>(
      async () => {
        const items = await config.fetchAPI<TContent[]>(`/${config.resource}`, { slug, _embed: 'true' });
        return items[0];
      },
      async () => {
        const items = await config.fetchAPI<TContent[]>(`/${config.resource}`, { slug, _embed: 'true', context: 'edit' });
        return items[0];
      },
      config.missingRawMessage,
      config.defaultBlockParser,
    );
  }

  return {
    list,
    listAll,
    listPaginated,
    getById,
    getBySlug,
  };
}
