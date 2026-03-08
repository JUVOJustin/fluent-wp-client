import type { WordPressPost } from './schemas.js';
import type { FetchResult, PaginatedResponse, PostsFilter } from './types.js';
/**
 * Posts API methods factory for typed read operations.
 */
export declare function createPostsMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>): {
    /**
     * Gets posts with optional filtering (single page, max 100 items).
     */
    getPosts(filter?: PostsFilter): Promise<WordPressPost[]>;
    /**
     * Gets all posts by automatically paginating through all pages.
     */
    getAllPosts(filter?: Omit<PostsFilter, "page">): Promise<WordPressPost[]>;
    /**
     * Gets posts with pagination metadata.
     */
    getPostsPaginated(filter?: PostsFilter): Promise<PaginatedResponse<WordPressPost>>;
    /**
     * Gets one post by ID.
     */
    getPost(id: number): Promise<WordPressPost>;
    /**
     * Gets one post by slug.
     */
    getPostBySlug(slug: string): Promise<WordPressPost | undefined>;
};
