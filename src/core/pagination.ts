import type { FetchResult, PaginatedResponse, PaginationParams } from '../types/resources.js';

/**
 * Generic paginator options for one WordPress collection resource.
 */
export interface WordPressPaginatorOptions<TFilter extends PaginationParams, TItem> {
  fetchPage: (filter: TFilter, context?: unknown) => Promise<FetchResult<TItem[]>>;
  defaultPerPage?: number;
}

/**
 * Creates one reusable paginator for built-in and custom endpoints.
 */
export function createWordPressPaginator<TFilter extends PaginationParams, TItem>(
  options: WordPressPaginatorOptions<TFilter, TItem>,
) {
  const defaultPerPage = options.defaultPerPage ?? 100;

  /**
   * Loads every page for the provided base filter.
   */
  async function listAll(
    filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
    context?: unknown,
  ): Promise<TItem[]> {
    const allItems: TItem[] = [];
    const perPage = (filter as PaginationParams).perPage ?? defaultPerPage;
    let page = 1;
    let totalPages = 1;

    do {
      const result = await options.fetchPage({ ...filter, page, perPage } as TFilter, context);
      allItems.push(...result.data);
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages);

    return allItems;
  }

  /**
   * Loads one page and normalizes pagination metadata.
   */
  async function listPaginated(filter: TFilter = {} as TFilter, context?: unknown): Promise<PaginatedResponse<TItem>> {
    const result = await options.fetchPage(filter, context);

    return {
      data: result.data,
      total: result.total,
      totalPages: result.totalPages,
      page: filter.page ?? 1,
      perPage: filter.perPage ?? defaultPerPage,
    };
  }

  return {
    listAll,
    listPaginated,
  };
}
