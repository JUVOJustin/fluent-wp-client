import type { WordPressPage } from './schemas.js';
import type { FetchResult, PaginatedResponse, PagesFilter } from './types.js';
import { filterToParams } from './types.js';

/**
 * Pages API methods factory for typed read operations.
 */
export function createPagesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  return {
    /**
     * Gets pages with optional filtering (single page, max 100 items).
     */
    async getPages(filter: PagesFilter = {}): Promise<WordPressPage[]> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      return fetchAPI<WordPressPage[]>('/pages', params);
    },

    /**
     * Gets all pages by automatically paginating through all pages.
     */
    async getAllPages(filter: Omit<PagesFilter, 'page'> = {}): Promise<WordPressPage[]> {
      const allPages: WordPressPage[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
        const result = await fetchAPIPaginated<WordPressPage[]>('/pages', params);
        allPages.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allPages;
    },

    /**
     * Gets pages with pagination metadata.
     */
    async getPagesPaginated(filter: PagesFilter = {}): Promise<PaginatedResponse<WordPressPage>> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      const result = await fetchAPIPaginated<WordPressPage[]>('/pages', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
    },

    /**
     * Gets one page by ID.
     */
    async getPage(id: number): Promise<WordPressPage> {
      return fetchAPI<WordPressPage>(`/pages/${id}`, { _embed: 'true' });
    },

    /**
     * Gets one page by slug.
     */
    async getPageBySlug(slug: string): Promise<WordPressPage | undefined> {
      const pages = await fetchAPI<WordPressPage[]>('/pages', { slug, _embed: 'true' });
      return pages[0];
    },
  };
}
