import type { WordPressPage } from './schemas.js';
import type { FetchResult, PaginatedResponse, PagesFilter } from './types.js';
/**
 * Pages API methods factory for typed read operations.
 */
export declare function createPagesMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>): {
    /**
     * Gets pages with optional filtering (single page, max 100 items).
     */
    getPages(filter?: PagesFilter): Promise<WordPressPage[]>;
    /**
     * Gets all pages by automatically paginating through all pages.
     */
    getAllPages(filter?: Omit<PagesFilter, "page">): Promise<WordPressPage[]>;
    /**
     * Gets pages with pagination metadata.
     */
    getPagesPaginated(filter?: PagesFilter): Promise<PaginatedResponse<WordPressPage>>;
    /**
     * Gets one page by ID.
     */
    getPage(id: number): Promise<WordPressPage>;
    /**
     * Gets one page by slug.
     */
    getPageBySlug(slug: string): Promise<WordPressPage | undefined>;
};
