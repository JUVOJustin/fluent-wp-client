import type { WordPressCategory } from './schemas.js';
import type { CategoriesFilter, FetchResult, PaginatedResponse } from './types.js';
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
      const allCategories: WordPressCategory[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 });
        const result = await fetchAPIPaginated<WordPressCategory[]>('/categories', params);
        allCategories.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allCategories;
    },

    /**
     * Gets categories with pagination metadata.
     */
    async getCategoriesPaginated(filter: CategoriesFilter = {}): Promise<PaginatedResponse<WordPressCategory>> {
      const params = filterToParams(filter);
      const result = await fetchAPIPaginated<WordPressCategory[]>('/categories', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
