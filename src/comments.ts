import type { WordPressComment } from './schemas.js';
import type { CommentsFilter, FetchResult, PaginatedResponse } from './types.js';
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
      const allComments: WordPressComment[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 });
        const result = await fetchAPIPaginated<WordPressComment[]>('/comments', params);
        allComments.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allComments;
    },

    /**
     * Gets comments with pagination metadata.
     */
    async getCommentsPaginated(filter: CommentsFilter = {}): Promise<PaginatedResponse<WordPressComment>> {
      const params = filterToParams(filter);
      const result = await fetchAPIPaginated<WordPressComment[]>('/comments', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
    },

    /**
     * Gets one comment by ID.
     */
    async getComment(id: number): Promise<WordPressComment> {
      return fetchAPI<WordPressComment>(`/comments/${id}`);
    },
  };
}
