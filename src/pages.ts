import type { WordPressPage } from './schemas.js';
import type { WordPressBlockParser } from './blocks.js';
import type { FetchResult, PaginatedResponse, PagesFilter } from './types.js';
import { WordPressContentQuery } from './content-query.js';
import { filterToParams } from './types.js';

/**
 * Pages API methods factory for typed read operations.
 */
export function createPagesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  defaultBlockParser?: WordPressBlockParser,
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
    getPage(id: number): WordPressContentQuery<WordPressPage> {
      return new WordPressContentQuery<WordPressPage>(
        () => fetchAPI<WordPressPage>(`/pages/${id}`, { _embed: 'true' }),
        () => fetchAPI<WordPressPage>(`/pages/${id}`, { _embed: 'true', context: 'edit' }),
        (page) => {
          if (page.content.raw === undefined) {
            throw new Error(
              'Raw page content is unavailable. The current credentials may not have edit capabilities for this page.',
            );
          }

          return {
            raw: page.content.raw,
            rendered: page.content.rendered,
            protected: page.content.protected,
          };
        },
        defaultBlockParser,
      );
    },

    /**
     * Gets one page by slug.
     */
    getPageBySlug(slug: string): WordPressContentQuery<WordPressPage | undefined> {
      return new WordPressContentQuery<WordPressPage | undefined>(
        async () => {
          const pages = await fetchAPI<WordPressPage[]>('/pages', { slug, _embed: 'true' });
          return pages[0];
        },
        async () => {
          const pages = await fetchAPI<WordPressPage[]>('/pages', { slug, _embed: 'true', context: 'edit' });
          return pages[0];
        },
        (page) => {
          if (!page) {
            return undefined;
          }

          if (page.content.raw === undefined) {
            throw new Error(
              'Raw page content is unavailable. The current credentials may not have edit capabilities for this page.',
            );
          }

          return {
            raw: page.content.raw,
            rendered: page.content.rendered,
            protected: page.content.protected,
          };
        },
        defaultBlockParser,
      );
    },
  };
}
