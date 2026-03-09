import type { WordPressMedia } from './schemas.js';
import type { FetchResult, MediaFilter, PaginatedResponse } from './types.js';
import { createWordPressPaginator } from './pagination.js';
import { filterToParams } from './types.js';

/**
 * Media API methods factory for typed read operations.
 */
export function createMediaMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
  const paginator = createWordPressPaginator<MediaFilter, WordPressMedia>({
    fetchPage: (filter) => {
      const params = filterToParams(filter);
      return fetchAPIPaginated<WordPressMedia[]>('/media', params);
    },
  });

  return {
    /**
     * Gets media items with optional filtering.
     */
    async getMedia(filter: MediaFilter = {}): Promise<WordPressMedia[]> {
      const params = filterToParams(filter);
      return fetchAPI<WordPressMedia[]>('/media', params);
    },

    /**
     * Gets all media items by paginating every page.
     */
    async getAllMedia(filter: Omit<MediaFilter, 'page'> = {}): Promise<WordPressMedia[]> {
      return paginator.listAll(filter);
    },

    /**
     * Gets media with pagination metadata.
     */
    async getMediaPaginated(filter: MediaFilter = {}): Promise<PaginatedResponse<WordPressMedia>> {
      return paginator.listPaginated(filter);
    },

    /**
     * Gets one media item by ID.
     */
    async getMediaItem(id: number): Promise<WordPressMedia> {
      return fetchAPI<WordPressMedia>(`/media/${id}`);
    },

    /**
     * Gets one media item by slug.
     */
    async getMediaBySlug(slug: string): Promise<WordPressMedia | undefined> {
      const media = await fetchAPI<WordPressMedia[]>('/media', { slug });
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
