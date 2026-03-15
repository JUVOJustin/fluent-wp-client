import type { WordPressTag } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { TagsFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Tags API methods factory for typed read operations.
 */
export function createTagsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  return {
    /**
     * Gets tags with optional filtering.
     */
    async getTags(filter: TagsFilter = {}, requestOptions?: WordPressRequestOverrides): Promise<WordPressTag[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressTag[]>('/tags', params, requestOptions);
    },

    /**
     * Gets all tags by paginating every page.
     */
    async getAllTags(
      filter: Omit<TagsFilter, 'page'> = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressTag[]> {
      const paginator = createWordPressPaginator<TagsFilter, WordPressTag>({
        fetchPage: (currentFilter) => {
          const params = filterToParams(currentFilter);
          return fetchAPIPaginated<WordPressTag[]>('/tags', params, requestOptions);
        },
      });

      return paginator.listAll(filter);
    },

    /**
     * Gets tags with pagination metadata.
     */
    async getTagsPaginated(
      filter: TagsFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<WordPressTag>> {
      const paginator = createWordPressPaginator<TagsFilter, WordPressTag>({
        fetchPage: (currentFilter) => {
          const params = filterToParams(currentFilter);
          return fetchAPIPaginated<WordPressTag[]>('/tags', params, requestOptions);
        },
      });

      return paginator.listPaginated(filter);
    },

    /**
     * Gets one tag by ID.
     */
    async getTag(id: number, requestOptions?: WordPressRequestOverrides): Promise<WordPressTag> {
      return fetchAPI<WordPressTag>(`/tags/${id}`, undefined, requestOptions);
    },

    /**
     * Gets one tag by slug.
     */
    async getTagBySlug(slug: string, requestOptions?: WordPressRequestOverrides): Promise<WordPressTag | undefined> {
      const tags = await fetchAPI<WordPressTag[]>('/tags', { slug }, requestOptions);
      return tags[0];
    },
  };
}
