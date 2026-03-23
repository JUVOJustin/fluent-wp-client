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
export class WordPressPaginator<TFilter extends PaginationParams, TItem> {
  private readonly defaultPerPage: number;

  constructor(private readonly options: WordPressPaginatorOptions<TFilter, TItem>) {
    this.defaultPerPage = options.defaultPerPage ?? 100;
  }

  /**
   * Loads every page for one base filter and flattens the results.
   */
  readonly listAll = async (
    filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
    context?: unknown,
  ): Promise<TItem[]> => {
    const allItems: TItem[] = [];
    const perPage = (filter as PaginationParams).perPage ?? this.defaultPerPage;
    let page = 1;
    let totalPages = 1;

    do {
      const result = await this.options.fetchPage({ ...filter, page, perPage } as TFilter, context);
      allItems.push(...result.data);
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages);

    return allItems;
  };

  /**
   * Loads one page and normalizes pagination metadata.
   */
  readonly listPaginated = async (
    filter: TFilter = {} as TFilter,
    context?: unknown,
  ): Promise<PaginatedResponse<TItem>> => {
    const result = await this.options.fetchPage(filter, context);

    return {
      data: result.data,
      total: result.total,
      totalPages: result.totalPages,
      page: filter.page ?? 1,
      perPage: filter.perPage ?? this.defaultPerPage,
    };
  };
}

/**
 * Creates one reusable paginator instance for built-in and custom endpoints.
 */
export function createWordPressPaginator<TFilter extends PaginationParams, TItem>(
  options: WordPressPaginatorOptions<TFilter, TItem>,
): WordPressPaginator<TFilter, TItem> {
  return new WordPressPaginator(options);
}
