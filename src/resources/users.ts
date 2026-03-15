import type { WordPressAuthor } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { UsersFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Users API methods factory for typed read operations.
 */
export function createUsersMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
  hasAuth: () => boolean,
) {
  const paginator = createWordPressPaginator<UsersFilter, WordPressAuthor>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(currentFilter);
      return fetchAPIPaginated<WordPressAuthor[]>('/users', params, context as WordPressRequestOverrides | undefined);
    },
  });

  return {
    /**
     * Gets users with optional filtering.
     */
    async getUsers(filter: UsersFilter = {}, requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressAuthor[]>('/users', params, requestOptions);
    },

    /**
     * Gets all users by paginating every page.
     */
    async getAllUsers(
      filter: Omit<UsersFilter, 'page'> = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressAuthor[]> {
      return paginator.listAll(filter, requestOptions);
    },

    /**
     * Gets users with pagination metadata.
     */
    async getUsersPaginated(
      filter: UsersFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<WordPressAuthor>> {
      return paginator.listPaginated(filter, requestOptions);
    },

    /**
     * Gets one user by ID.
     */
    async getUser(id: number, requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor> {
      return fetchAPI<WordPressAuthor>(`/users/${id}`, undefined, requestOptions);
    },

    /**
     * Gets the currently authenticated user.
     */
    async getCurrentUser(requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
      }

      return fetchAPI<WordPressAuthor>('/users/me', undefined, requestOptions);
    },
  };
}
