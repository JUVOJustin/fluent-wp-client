import type { WordPressTag } from './schemas.js';
import type { FetchResult, PaginatedResponse, TagsFilter } from './types.js';
import { createWordPressPaginator } from './pagination.js';
import { filterToParams } from './types.js';

/**
 * Tags API methods factory for typed read operations.
 */
export function createTagsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  const paginator = createWordPressPaginator<TagsFilter, WordPressTag>({
    fetchPage: (filter) => {
      const params = filterToParams(filter);
      return fetchAPIPaginated<WordPressTag[]>('/tags', params);
    },
  });

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
      return paginator.listAll(filter);
    },

    /**
     * Gets tags with pagination metadata.
     */
    async getTagsPaginated(filter: TagsFilter = {}): Promise<PaginatedResponse<WordPressTag>> {
      return paginator.listPaginated(filter);
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
