import type { WordPressTag } from './schemas.js';
import type { FetchResult, PaginatedResponse, TagsFilter } from './types.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';
import { filterToParams } from './types.js';

/**
 * Tags API methods factory for typed read operations.
 */
export function createTagsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  return {
    /**
     * Gets tags with optional filtering.
     */
    async getTags(filter: TagsFilter = {}): Promise<WordPressTag[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressTag[]>('/tags', params);
    },

    /**
     * Gets all tags by paginating every page.
     */
    async getAllTags(filter: Omit<TagsFilter, 'page'> = {}): Promise<WordPressTag[]> {
      return fetchAllPaginatedItems<WordPressTag>({
        fetchPage: (page, perPage) => {
          const params = filterToParams({ ...filter, page, perPage });
          return fetchAPIPaginated<WordPressTag[]>('/tags', params);
        },
      });
    },

    /**
     * Gets tags with pagination metadata.
     */
    async getTagsPaginated(filter: TagsFilter = {}): Promise<PaginatedResponse<WordPressTag>> {
      const page = filter.page || 1;
      const perPage = filter.perPage || 100;

      return fetchPaginatedResponse<WordPressTag>({
        runtime: {
          fetchPage: (currentPage, currentPerPage) => {
            const params = filterToParams({ ...filter, page: currentPage, perPage: currentPerPage });
            return fetchAPIPaginated<WordPressTag[]>('/tags', params);
          },
        },
        page,
        perPage,
      });
    },

    /**
     * Gets one tag by ID.
     */
    async getTag(id: number): Promise<WordPressTag> {
      return fetchAPI<WordPressTag>(`/tags/${id}`);
    },

    /**
     * Gets one tag by slug.
     */
    async getTagBySlug(slug: string): Promise<WordPressTag | undefined> {
      const tags = await fetchAPI<WordPressTag[]>('/tags', { slug });
      return tags[0];
    },
  };
}
