import type { WordPressTag } from './schemas.js';
import type { FetchResult, PaginatedResponse, TagsFilter } from './types.js';
/**
 * Tags API methods factory for typed read operations.
 */
export declare function createTagsMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>): {
    /**
     * Gets tags with optional filtering.
     */
    getTags(filter?: TagsFilter): Promise<WordPressTag[]>;
    /**
     * Gets all tags by paginating every page.
     */
    getAllTags(filter?: Omit<TagsFilter, "page">): Promise<WordPressTag[]>;
    /**
     * Gets tags with pagination metadata.
     */
    getTagsPaginated(filter?: TagsFilter): Promise<PaginatedResponse<WordPressTag>>;
    /**
     * Gets one tag by ID.
     */
    getTag(id: number): Promise<WordPressTag>;
    /**
     * Gets one tag by slug.
     */
    getTagBySlug(slug: string): Promise<WordPressTag | undefined>;
};
