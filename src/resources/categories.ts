import type { WordPressCategory } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Categories API methods factory for typed read operations.
 */
export function createCategoriesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const paginator = createWordPressPaginator<CategoriesFilter, WordPressCategory>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(currentFilter);
      return fetchAPIPaginated<WordPressCategory[]>('/categories', params, context as WordPressRequestOverrides | undefined);
    },
  });

  return {
    /**
     * Gets categories with optional filtering.
     */
    async getCategories(
      filter: CategoriesFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressCategory[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressCategory[]>('/categories', params, requestOptions);
    },

    /**
     * Gets all categories by paginating every page.
     */
    async getAllCategories(
      filter: Omit<CategoriesFilter, 'page'> = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressCategory[]> {
      return paginator.listAll(filter, requestOptions);
    },

    /**
     * Gets categories with pagination metadata.
     */
    async getCategoriesPaginated(
      filter: CategoriesFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<WordPressCategory>> {
      return paginator.listPaginated(filter, requestOptions);
    },

    /**
     * Gets one category by ID.
     */
    async getCategory(id: number, requestOptions?: WordPressRequestOverrides): Promise<WordPressCategory> {
      return fetchAPI<WordPressCategory>(`/categories/${id}`, undefined, requestOptions);
    },

    /**
     * Gets one category by slug.
     */
    async getCategoryBySlug(
      slug: string,
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressCategory | undefined> {
      const categories = await fetchAPI<WordPressCategory[]>('/categories', { slug }, requestOptions);
      return categories[0];
    },
  };
}
