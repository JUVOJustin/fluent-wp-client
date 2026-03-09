import type { WordPressAuthor } from './schemas.js';
import type { FetchResult, PaginatedResponse, UsersFilter } from './types.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';
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
      return fetchAllPaginatedItems<WordPressAuthor>({
        fetchPage: (page, perPage) => {
          const params = filterToParams({ ...filter, page, perPage });
          return fetchAPIPaginated<WordPressAuthor[]>('/users', params);
        },
      });
    },

    /**
     * Gets users with pagination metadata.
     */
    async getUsersPaginated(filter: UsersFilter = {}): Promise<PaginatedResponse<WordPressAuthor>> {
      return fetchPaginatedResponse<WordPressAuthor>({
        runtime: {
          fetchPage: (currentPage, currentPerPage) => {
            const params = filterToParams({
              ...filter,
              ...(currentPage !== undefined ? { page: currentPage } : {}),
              ...(currentPerPage !== undefined ? { perPage: currentPerPage } : {}),
            });
            return fetchAPIPaginated<WordPressAuthor[]>('/users', params);
          },
        },
        page: filter.page,
        perPage: filter.perPage,
      });
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
