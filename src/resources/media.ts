import type { WordPressMedia } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { MediaFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createCollectionReadMethods } from '../core/collection-read-methods.js';

/**
 * Media API methods factory for typed read operations.
 */
export function createMediaMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const core = createCollectionReadMethods<WordPressMedia, MediaFilter>({
    endpoint: '/media',
    fetchAPI,
    fetchAPIPaginated,
  });

  return {
    /** Gets media items with optional filtering. */
    getMedia: (filter?: MediaFilter, options?: WordPressRequestOverrides): Promise<WordPressMedia[]> =>
      core.list(filter, options),

    /** Gets all media items by paginating every page. */
    getAllMedia: (filter?: Omit<MediaFilter, 'page'>, options?: WordPressRequestOverrides): Promise<WordPressMedia[]> =>
      core.listAll(filter, options),

    /** Gets media with pagination metadata. */
    getMediaPaginated: (filter?: MediaFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<WordPressMedia>> =>
      core.listPaginated(filter, options),

    /** Gets one media item by ID. */
    getMediaItem: (id: number, options?: WordPressRequestOverrides): Promise<WordPressMedia> =>
      core.getById(id, options),

    /** Gets one media item by slug. */
    getMediaBySlug: (slug: string, options?: WordPressRequestOverrides): Promise<WordPressMedia | undefined> =>
      core.getBySlug(slug, options),

    /**
     * Gets one image URL for a specific media size key.
     * Falls back to `source_url` when the requested size is not available.
     */
    getImageUrl(media: WordPressMedia, size: string = 'full'): string {
      if (size === 'full' || !media.media_details.sizes[size]) {
        return media.source_url;
      }

      return media.media_details.sizes[size].source_url;
    },
  };
}
