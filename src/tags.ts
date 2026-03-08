import type { WordPressTag } from './schemas.js';
import type { FetchResult, PaginatedResponse, TagsFilter } from './types.js';
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
      const allTags: WordPressTag[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 });
        const result = await fetchAPIPaginated<WordPressTag[]>('/tags', params);
        allTags.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allTags;
    },

    /**
     * Gets tags with pagination metadata.
     */
    async getTagsPaginated(filter: TagsFilter = {}): Promise<PaginatedResponse<WordPressTag>> {
      const params = filterToParams(filter);
      const result = await fetchAPIPaginated<WordPressTag[]>('/tags', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
