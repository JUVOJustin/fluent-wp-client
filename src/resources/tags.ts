import type { WordPressTag } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { TagsFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Tags API methods factory for typed read operations.
 */
export function createTagsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const core = createCollectionReadMethods<WordPressTag, TagsFilter>({
    endpoint: '/tags',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets tags with optional filtering. */
    getTags: (filter?: TagsFilter, options?: WordPressRequestOverrides): Promise<WordPressTag[]> =>
      core.list(filter, options),

    /** Gets all tags by paginating every page. */
    getAllTags: (filter?: Omit<TagsFilter, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressTag[]> =>
      core.listAll(filter, options),

    /** Gets tags with pagination metadata. */
    getTagsPaginated: (filter?: TagsFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressTag>> =>
      core.listPaginated(filter, options),

    /** Gets one tag by ID. */
    getTag: (id: number, options?: WordPressRequestOverrides): Promise<WordPressTag> =>
      core.getById(id, options),

    /** Gets one tag by slug. */
    getTagBySlug: (slug: string, options?: WordPressRequestOverrides): Promise<WordPressTag | undefined> =>
      core.getBySlug(slug, options),
  };
}
