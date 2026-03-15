import type { WordPressMedia } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { MediaFilter } from '../types/filters.js';
import type { FetchResult, PaginatedResponse } from '../types/resources.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { filterToParams } from '../core/params.js';

/**
 * Media API methods factory for typed read operations.
 */
export function createMediaMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
) {
  const paginator = createWordPressPaginator<MediaFilter, WordPressMedia>({
    fetchPage: (currentFilter, context) => {
      const params = filterToParams(currentFilter);
      return fetchAPIPaginated<WordPressMedia[]>('/media', params, context as WordPressRequestOverrides | undefined);
    },
  });

  return {
    /**
     * Gets media items with optional filtering.
     */
    async getMedia(filter: MediaFilter = {}, requestOptions?: WordPressRequestOverrides): Promise<WordPressMedia[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressMedia[]>('/media', params, requestOptions);
    },

    /**
     * Gets all media items by paginating every page.
     */
    async getAllMedia(
      filter: Omit<MediaFilter, 'page'> = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<WordPressMedia[]> {
      return paginator.listAll(filter, requestOptions);
    },

    /**
     * Gets media with pagination metadata.
     */
    async getMediaPaginated(
      filter: MediaFilter = {},
      requestOptions?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<WordPressMedia>> {
      return paginator.listPaginated(filter, requestOptions);
    },

    /**
     * Gets one media item by ID.
     */
    async getMediaItem(id: number, requestOptions?: WordPressRequestOverrides): Promise<WordPressMedia> {
      return fetchAPI<WordPressMedia>(`/media/${id}`, undefined, requestOptions);
    },

    /**
     * Gets one media item by slug.
     */
    async getMediaBySlug(slug: string, requestOptions?: WordPressRequestOverrides): Promise<WordPressMedia | undefined> {
      const media = await fetchAPI<WordPressMedia[]>('/media', { slug }, requestOptions);
      return media[0];
    },

    /**
     * Gets one image URL for a specific media size key.
     */
    getImageUrl(media: WordPressMedia, size: string = 'full'): string {
      if (size === 'full' || !media.media_details.sizes[size]) {
        return media.source_url;
      }

      return media.media_details.sizes[size].source_url;
    },
  };
}
