import type { WordPressCategory } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Categories API methods factory for typed read operations.
 */
export function createCategoriesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const core = createCollectionReadMethods<WordPressCategory, CategoriesFilter>({
    endpoint: '/categories',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets categories with optional filtering. */
    getCategories: (filter?: CategoriesFilter, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> =>
      core.list(filter, options),

    /** Gets all categories by paginating every page. */
    getAllCategories: (filter?: Omit<CategoriesFilter, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> =>
      core.listAll(filter, options),

    /** Gets categories with pagination metadata. */
    getCategoriesPaginated: (filter?: CategoriesFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressCategory>> =>
      core.listPaginated(filter, options),

    /** Gets one category by ID. */
    getCategory: (id: number, options?: WordPressRequestOverrides): Promise<WordPressCategory> =>
      core.getById(id, options),

    /** Gets one category by slug. */
    getCategoryBySlug: (slug: string, options?: WordPressRequestOverrides): Promise<WordPressCategory | undefined> =>
      core.getBySlug(slug, options),
  };
}
