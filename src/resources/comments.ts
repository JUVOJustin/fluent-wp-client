import type { WordPressComment } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { CommentsFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, PaginatedResponse, SerializedQueryParams } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Comments API methods factory for typed read operations.
 */
export function createCommentsMethods(
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const core = createCollectionReadMethods<WordPressComment, ExtensibleFilter<CommentsFilter>>({
    endpoint: '/comments',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets comments with optional filtering. */
    getComments: (filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides): Promise<WordPressComment[]> =>
      core.list(filter, options),

    /** Gets all comments by paginating every page. */
    getAllComments: (filter?: Omit<ExtensibleFilter<CommentsFilter>, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressComment[]> =>
      core.listAll(filter, options),

    /** Gets comments with pagination metadata. */
    getCommentsPaginated: (filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressComment>> =>
      core.listPaginated(filter, options),

    /** Gets one comment by ID. */
    getComment: (id: number, options?: WordPressRequestOverrides): Promise<WordPressComment> =>
      core.getById(id, options),
  };
}
