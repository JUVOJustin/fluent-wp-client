import type { WordPressAuthor } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { UsersFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, PaginatedResponse, SerializedQueryParams } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Users API methods factory for typed read operations.
 */
export function createUsersMethods(
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
  hasAuth: () => boolean,
) {
  const core = createCollectionReadMethods<WordPressAuthor, ExtensibleFilter<UsersFilter>>({
    endpoint: '/users',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets users with optional filtering. */
    getUsers: (filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides): Promise<WordPressAuthor[]> =>
      core.list(filter, options),

    /** Gets all users by paginating every page. */
    getAllUsers: (filter?: Omit<ExtensibleFilter<UsersFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressAuthor[]> =>
      core.listAll(filter, options),

    /** Gets users with pagination metadata. */
    getUsersPaginated: (filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressAuthor>> =>
      core.listPaginated(filter, options),

    /** Gets one user by ID. */
    getUser: (id: number, options?: WordPressRequestOverrides): Promise<WordPressAuthor> =>
      core.getById(id, options),

    /** Gets the currently authenticated user. */
    async getCurrentUser(requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
      }

      return fetchAPI<WordPressAuthor>('/users/me', undefined, requestOptions);
    },
  };
}
