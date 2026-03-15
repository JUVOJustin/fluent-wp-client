import type { WordPressComment } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { CommentsFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Comments API methods factory for typed read operations.
 */
export function createCommentsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  return {
    /**
     * Gets comments with optional filtering.
     */
    async getComments(
      filter: CommentsFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressComment[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressComment[]>('/comments', params, requestOptions);
    },

    /**
     * Gets all comments by paginating every page.
     */
    async getAllComments(
      filter: Omit<CommentsFilter, 'page'> = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressComment[]> {
      const paginator = createWordPressPaginator<CommentsFilter, WordPressComment>({
        fetchPage: (currentFilter) => {
          const params = filterToParams(currentFilter);
          return fetchAPIPaginated<WordPressComment[]>('/comments', params, requestOptions);
        },
      });

      return paginator.listAll(filter);
    },

    /**
     * Gets comments with pagination metadata.
     */
    async getCommentsPaginated(
      filter: CommentsFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<WordPressComment>> {
      const paginator = createWordPressPaginator<CommentsFilter, WordPressComment>({
        fetchPage: (currentFilter) => {
          const params = filterToParams(currentFilter);
          return fetchAPIPaginated<WordPressComment[]>('/comments', params, requestOptions);
        },
      });

      return paginator.listPaginated(filter);
    },

    /**
     * Gets one comment by ID.
     */
    async getComment(id: number, requestOptions?: WordPressRequestOverrides): Promise<WordPressComment> {
      return fetchAPI<WordPressComment>(`/comments/${id}`, undefined, requestOptions);
    },
  };
}
