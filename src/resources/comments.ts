import type { WordPressComment } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { CommentsFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Comments API methods factory for typed read operations.
 */
export function createCommentsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const core = createCollectionReadMethods<WordPressComment, CommentsFilter>({
    endpoint: '/comments',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets comments with optional filtering. */
    getComments: (filter?: CommentsFilter, options?: WordPressRequestOverrides): Promise<WordPressComment[]> =>
      core.list(filter, options),

    /** Gets all comments by paginating every page. */
    getAllComments: (filter?: Omit<CommentsFilter, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressComment[]> =>
      core.listAll(filter, options),

    /** Gets comments with pagination metadata. */
    getCommentsPaginated: (filter?: CommentsFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressComment>> =>
      core.listPaginated(filter, options),

    /** Gets one comment by ID. */
    getComment: (id: number, options?: WordPressRequestOverrides): Promise<WordPressComment> =>
      core.getById(id, options),
  };
}
