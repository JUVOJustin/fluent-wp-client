import type { WordPressCategory } from './schemas.js';
import type { CategoriesFilter, FetchResult, PaginatedResponse } from './types.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';
import { filterToParams } from './types.js';

/**
 * Categories API methods factory for typed read operations.
 */
export function createCategoriesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  return {
    /**
     * Gets categories with optional filtering.
     */
    async getCategories(filter: CategoriesFilter = {}): Promise<WordPressCategory[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressCategory[]>('/categories', params);
    },

    /**
     * Gets all categories by paginating every page.
     */
    async getAllCategories(filter: Omit<CategoriesFilter, 'page'> = {}): Promise<WordPressCategory[]> {
      return fetchAllPaginatedItems<WordPressCategory>({
        fetchPage: (page, perPage) => {
          const params = filterToParams({ ...filter, page, perPage });
          return fetchAPIPaginated<WordPressCategory[]>('/categories', params);
        },
      });
    },

    /**
     * Gets categories with pagination metadata.
     */
    async getCategoriesPaginated(filter: CategoriesFilter = {}): Promise<PaginatedResponse<WordPressCategory>> {
      const page = filter.page || 1;
      const perPage = filter.perPage || 100;

      return fetchPaginatedResponse<WordPressCategory>({
        runtime: {
          fetchPage: (currentPage, currentPerPage) => {
            const params = filterToParams({ ...filter, page: currentPage, perPage: currentPerPage });
            return fetchAPIPaginated<WordPressCategory[]>('/categories', params);
          },
        },
        page,
        perPage,
      });
    },

    /**
     * Gets one category by ID.
     */
    async getCategory(id: number): Promise<WordPressCategory> {
      return fetchAPI<WordPressCategory>(`/categories/${id}`);
    },

    /**
     * Gets one category by slug.
     */
    async getCategoryBySlug(slug: string): Promise<WordPressCategory | undefined> {
      const categories = await fetchAPI<WordPressCategory[]>('/categories', { slug });
      return categories[0];
    },
  };
}
