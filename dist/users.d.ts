import type { WordPressAuthor } from './schemas.js';
import type { FetchResult, PaginatedResponse, UsersFilter } from './types.js';
/**
 * Users API methods factory for typed read operations.
 */
export declare function createUsersMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>, hasAuth: () => boolean): {
    /**
     * Gets users with optional filtering.
     */
    getUsers(filter?: UsersFilter): Promise<WordPressAuthor[]>;
    /**
     * Gets all users by paginating every page.
     */
    getAllUsers(filter?: Omit<UsersFilter, "page">): Promise<WordPressAuthor[]>;
    /**
     * Gets users with pagination metadata.
     */
    getUsersPaginated(filter?: UsersFilter): Promise<PaginatedResponse<WordPressAuthor>>;
    /**
     * Gets one user by ID.
     */
    getUser(id: number): Promise<WordPressAuthor>;
    /**
     * Gets the currently authenticated user.
     */
    getCurrentUser(): Promise<WordPressAuthor>;
};
