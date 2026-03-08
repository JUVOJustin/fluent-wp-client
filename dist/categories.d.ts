import type { WordPressCategory } from './schemas.js';
import type { CategoriesFilter, FetchResult, PaginatedResponse } from './types.js';
/**
 * Categories API methods factory for typed read operations.
 */
export declare function createCategoriesMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>): {
    /**
     * Gets categories with optional filtering.
     */
    getCategories(filter?: CategoriesFilter): Promise<WordPressCategory[]>;
    /**
     * Gets all categories by paginating every page.
     */
    getAllCategories(filter?: Omit<CategoriesFilter, "page">): Promise<WordPressCategory[]>;
    /**
     * Gets categories with pagination metadata.
     */
    getCategoriesPaginated(filter?: CategoriesFilter): Promise<PaginatedResponse<WordPressCategory>>;
    /**
     * Gets one category by ID.
     */
    getCategory(id: number): Promise<WordPressCategory>;
    /**
     * Gets one category by slug.
     */
    getCategoryBySlug(slug: string): Promise<WordPressCategory | undefined>;
};
