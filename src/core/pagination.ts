import type { FetchResult, PaginatedResponse, PaginationParams } from '../types/resources.js';

/**
 * Options for controlling parallel fetching behavior in listAll.
 */
export interface ListAllOptions {
  /**
   * Maximum number of pages to fetch in parallel.
   * Higher values = faster but more concurrent requests.
   * Lower values = slower but gentler on server.
   * @default 5
   */
  concurrency?: number;
}

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
   * Uses parallel fetching for significantly improved performance.
   * 
   * First fetches page 1 to get total count from headers, then spawns parallel
   * requests for remaining pages in batches. Results are combined in order.
   */
  readonly listAll = async (
    filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
    context?: unknown,
    options?: ListAllOptions,
  ): Promise<TItem[]> => {
    const perPage = (filter as PaginationParams).perPage ?? this.defaultPerPage;
    const rawConcurrency = options?.concurrency ?? 5;
    const concurrency = Math.max(1, Math.floor(Number.isFinite(rawConcurrency) ? rawConcurrency : 5));

    // Fetch first page to get total count
    const firstPage = await this.options.fetchPage({ ...filter, page: 1, perPage } as TFilter, context);
    
    // Single page - no need for parallel fetching
    if (firstPage.totalPages <= 1) {
      return firstPage.data;
    }

    // Generate page numbers for remaining pages
    const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, i) => i + 2);
    
    // Fetch remaining pages in parallel batches
    const fetchRemainingPages = async (): Promise<Map<number, TItem[]>> => {
      const pageDataMap = new Map<number, TItem[]>();
      
      for (let i = 0; i < remainingPages.length; i += concurrency) {
        const batch = remainingPages.slice(i, i + concurrency);
        const batchPromises = batch.map(async page => {
          const result = await this.options.fetchPage({ ...filter, page, perPage } as TFilter, context);
          return { page, data: result.data };
        });
        
        const batchResults = await Promise.all(batchPromises);
        for (const { page, data } of batchResults) {
          pageDataMap.set(page, data);
        }
      }
      
      return pageDataMap;
    };

    const remainingData = await fetchRemainingPages();

    // Combine all results in page order
    const allItems: TItem[] = [...firstPage.data];
    for (let page = 2; page <= firstPage.totalPages; page++) {
      const pageData = remainingData.get(page);
      if (pageData) {
        allItems.push(...pageData);
      }
    }

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
