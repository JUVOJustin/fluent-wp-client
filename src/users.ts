import type { WordPressAuthor } from './schemas.js';
import type { FetchResult, PaginatedResponse, UsersFilter } from './types.js';
import { filterToParams } from './types.js';

/**
 * Users API methods factory for typed read operations.
 */
export function createUsersMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  hasAuth: () => boolean,
) {
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
      const allUsers: WordPressAuthor[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 });
        const result = await fetchAPIPaginated<WordPressAuthor[]>('/users', params);
        allUsers.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allUsers;
    },

    /**
     * Gets users with pagination metadata.
     */
    async getUsersPaginated(filter: UsersFilter = {}): Promise<PaginatedResponse<WordPressAuthor>> {
      const params = filterToParams(filter);
      const result = await fetchAPIPaginated<WordPressAuthor[]>('/users', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
