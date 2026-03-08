import type { WordPressComment } from './schemas.js';
import type { CommentsFilter, FetchResult, PaginatedResponse } from './types.js';
/**
 * Comments API methods factory for typed read operations.
 */
export declare function createCommentsMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>): {
    /**
     * Gets comments with optional filtering.
     */
    getComments(filter?: CommentsFilter): Promise<WordPressComment[]>;
    /**
     * Gets all comments by paginating every page.
     */
    getAllComments(filter?: Omit<CommentsFilter, "page">): Promise<WordPressComment[]>;
    /**
     * Gets comments with pagination metadata.
     */
    getCommentsPaginated(filter?: CommentsFilter): Promise<PaginatedResponse<WordPressComment>>;
    /**
     * Gets one comment by ID.
     */
    getComment(id: number): Promise<WordPressComment>;
};
