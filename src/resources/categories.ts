import type { WordPressCategory } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, PaginatedResponse, SerializedQueryParams } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Categories API methods factory for typed read operations.
 */
export function createCategoriesMethods(
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const core = createCollectionReadMethods<WordPressCategory, ExtensibleFilter<CategoriesFilter>>({
    endpoint: '/categories',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets categories with optional filtering. */
    getCategories: (filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> =>
      core.list(filter, options),

    /** Gets all categories by paginating every page. */
    getAllCategories: (filter?: Omit<ExtensibleFilter<CategoriesFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> =>
      core.listAll(filter, options),

    /** Gets categories with pagination metadata. */
    getCategoriesPaginated: (filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressCategory>> =>
      core.listPaginated(filter, options),

    /** Gets one category by ID. */
    getCategory: (id: number, options?: WordPressRequestOverrides): Promise<WordPressCategory> =>
      core.getById(id, options),

    /** Gets one category by slug. */
    getCategoryBySlug: (slug: string, options?: WordPressRequestOverrides): Promise<WordPressCategory | undefined> =>
      core.getBySlug(slug, options),
  };
}
