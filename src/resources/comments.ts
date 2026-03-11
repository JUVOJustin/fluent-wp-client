import type { WordPressComment } from '../schemas.js';
import type { CommentsFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Comments API methods factory for typed read operations.
 */
export function createCommentsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  const paginator = createWordPressPaginator<CommentsFilter, WordPressComment>({
    fetchPage: (filter) => {
      const params = filterToParams(filter);
      return fetchAPIPaginated<WordPressComment[]>('/comments', params);
    },
  });

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
      return paginator.listAll(filter);
    },

    /**
     * Gets comments with pagination metadata.
     */
    async getCommentsPaginated(filter: CommentsFilter = {}): Promise<PaginatedResponse<WordPressComment>> {
      return paginator.listPaginated(filter);
    },

    /**
     * Gets one comment by ID.
     */
    async getComment(id: number): Promise<WordPressComment> {
      return fetchAPI<WordPressComment>(`/comments/${id}`);
    },
  };
}
