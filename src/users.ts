import type { WordPressAuthor } from './schemas.js';
import type { FetchResult, PaginatedResponse, UsersFilter } from './types.js';
import { createWordPressPaginator } from './pagination.js';
import { filterToParams } from './types.js';

/**
 * Users API methods factory for typed read operations.
 */
export function createUsersMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  hasAuth: () => boolean,
) {
  const paginator = createWordPressPaginator<UsersFilter, WordPressAuthor>({
    fetchPage: (filter) => {
      const params = filterToParams(filter);
      return fetchAPIPaginated<WordPressAuthor[]>('/users', params);
    },
  });

  return {
    /**
     * Gets users with optional filtering.
     */
    async getUsers(filter: UsersFilter = {}): Promise<WordPressAuthor[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressAuthor[]>('/users', params);
    },

    /**
     * Gets all users by paginating every page.
     */
    async getAllUsers(filter: Omit<UsersFilter, 'page'> = {}): Promise<WordPressAuthor[]> {
      return paginator.listAll(filter);
    },

    /**
     * Gets users with pagination metadata.
     */
    async getUsersPaginated(filter: UsersFilter = {}): Promise<PaginatedResponse<WordPressAuthor>> {
      return paginator.listPaginated(filter);
    },

    /**
     * Gets one user by ID.
     */
    async getUser(id: number): Promise<WordPressAuthor> {
      return fetchAPI<WordPressAuthor>(`/users/${id}`);
    },

    /**
     * Gets the currently authenticated user.
     */
    async getCurrentUser(): Promise<WordPressAuthor> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
      }

      return fetchAPI<WordPressAuthor>('/users/me');
    },
  };
}
