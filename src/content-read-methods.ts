import type { WordPressBlockParser } from './blocks.js';
import {
  WordPressContentQuery,
  createWordPressContentRecord,
  type WordPressContentRecord,
} from './content-query.js';
import type { WordPressPostBase } from './schemas.js';
import {
  filterToParams,
  type FetchResult,
  type PaginatedResponse,
  type PaginationParams,
} from './types.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';

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
 */
export function createPostLikeReadMethods<
  TContent extends WordPressPostBase,
  TFilter extends PaginationParams,
>(config: PostLikeReadMethodConfig<TContent, TFilter>) {
  const withDefaultFilter = config.withDefaultFilter ?? ((filter) => ({ ...filter, _embed: 'true' }));

  /**
   * Wraps one post-like response item with block helper methods.
   */
  function wrapRecord(item: TContent): WordPressContentRecord<TContent> {
    return createWordPressContentRecord<TContent>({
      value: item,
      loadEdit: () => config.fetchAPI<TContent>(`/${config.resource}/${item.id}`, { _embed: 'true', context: 'edit' }),
      missingRawMessage: config.missingRawMessage,
      defaultBlockParser: config.defaultBlockParser,
    });
  }

  /**
   * Lists one page of post-like content.
   */
  async function list(filter: TFilter = {} as TFilter): Promise<Array<WordPressContentRecord<TContent>>> {
    const params = filterToParams(withDefaultFilter(filter));
    const items = await config.fetchAPI<TContent[]>(`/${config.resource}`, params);
    return items.map((item) => wrapRecord(item));
  }

  /**
   * Lists all post-like content by paging through the entire resource.
   */
  async function listAll(filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>): Promise<Array<WordPressContentRecord<TContent>>> {
    const items = await fetchAllPaginatedItems<TContent>({
      fetchPage: (page, perPage) => {
        const params = filterToParams(withDefaultFilter({ ...filter, page, perPage } as TFilter & PaginationParams));
        return config.fetchAPIPaginated<TContent[]>(`/${config.resource}`, params);
      },
    });

    return items.map((item) => wrapRecord(item));
  }

  /**
   * Lists one page of post-like content with pagination metadata.
   */
  async function listPaginated(filter: TFilter = {} as TFilter): Promise<PaginatedResponse<WordPressContentRecord<TContent>>> {
    const page = filter.page || 1;
    const perPage = filter.perPage || 100;

    const result = await fetchPaginatedResponse<TContent>({
      runtime: {
        fetchPage: (currentPage, currentPerPage) => {
          const params = filterToParams(
            withDefaultFilter({ ...filter, page: currentPage, perPage: currentPerPage } as TFilter & PaginationParams),
          );
          return config.fetchAPIPaginated<TContent[]>(`/${config.resource}`, params);
        },
      },
      page,
      perPage,
    });

    return {
      ...result,
      data: result.data.map((item) => wrapRecord(item)),
    };
  }

  /**
   * Gets one post-like record by numeric ID.
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
   * Gets one post-like record by slug.
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
