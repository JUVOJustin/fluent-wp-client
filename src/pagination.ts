import type { FetchResult, PaginatedResponse } from './types.js';

/**
 * Runtime contract for fetching one paginated WordPress resource page.
 */
export interface PaginatedFetchRuntime<TItem> {
  fetchPage: (page?: number, perPage?: number) => Promise<FetchResult<TItem[]>>;
}

/**
 * Loads all pages from one WordPress paginated endpoint.
 */
export async function fetchAllPaginatedItems<TItem>(
  runtime: PaginatedFetchRuntime<TItem>,
  perPage: number = 100,
): Promise<TItem[]> {
  const allItems: TItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await runtime.fetchPage(page, perPage);
    allItems.push(...result.data);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);

  return allItems;
}

/**
 * Loads one page and normalizes WordPress pagination metadata.
 */
export async function fetchPaginatedResponse<TItem>(config: {
  runtime: PaginatedFetchRuntime<TItem>;
  page?: number;
  perPage?: number;
  defaultPage?: number;
  defaultPerPage?: number;
}): Promise<PaginatedResponse<TItem>> {
  const result = await config.runtime.fetchPage(config.page, config.perPage);
  const page = config.page ?? config.defaultPage ?? 1;
  const perPage = config.perPage ?? config.defaultPerPage ?? 100;

  return {
    data: result.data,
    total: result.total,
    totalPages: result.totalPages,
    page,
    perPage,
  };
}
