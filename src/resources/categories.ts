import type { WordPressCategory } from '../schemas.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Categories API methods factory for typed read operations.
 */
export function createCategoriesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  const paginator = createWordPressPaginator<CategoriesFilter, WordPressCategory>({
    fetchPage: (filter) => {
      const params = filterToParams(filter);
      return fetchAPIPaginated<WordPressCategory[]>('/categories', params);
    },
  });

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
      return paginator.listAll(filter);
    },

    /**
     * Gets categories with pagination metadata.
     */
    async getCategoriesPaginated(filter: CategoriesFilter = {}): Promise<PaginatedResponse<WordPressCategory>> {
      return paginator.listPaginated(filter);
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
