import type { WordPressComment } from './schemas.js';
import type { CommentsFilter, FetchResult, PaginatedResponse } from './types.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';
import { filterToParams } from './types.js';

/**
 * Comments API methods factory for typed read operations.
 */
export function createCommentsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  return {
    /**
     * Gets comments with optional filtering.
     */
    async getComments(filter: CommentsFilter = {}): Promise<WordPressComment[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressComment[]>('/comments', params);
    },

    /**
     * Gets all comments by paginating every page.
     */
    async getAllComments(filter: Omit<CommentsFilter, 'page'> = {}): Promise<WordPressComment[]> {
      return fetchAllPaginatedItems<WordPressComment>({
        fetchPage: (page, perPage) => {
          const params = filterToParams({ ...filter, page, perPage });
          return fetchAPIPaginated<WordPressComment[]>('/comments', params);
        },
      });
    },

    /**
     * Gets comments with pagination metadata.
     */
    async getCommentsPaginated(filter: CommentsFilter = {}): Promise<PaginatedResponse<WordPressComment>> {
      const page = filter.page || 1;
      const perPage = filter.perPage || 100;

      return fetchPaginatedResponse<WordPressComment>({
        runtime: {
          fetchPage: (currentPage, currentPerPage) => {
            const params = filterToParams({ ...filter, page: currentPage, perPage: currentPerPage });
            return fetchAPIPaginated<WordPressComment[]>('/comments', params);
          },
        },
        page,
        perPage,
      });
    },

    /**
     * Gets one comment by ID.
     */
    async getComment(id: number): Promise<WordPressComment> {
      return fetchAPI<WordPressComment>(`/comments/${id}`);
    },
  };
}
