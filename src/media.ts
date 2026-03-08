import type { WordPressMedia } from './schemas.js';
import type { FetchResult, MediaFilter, PaginatedResponse } from './types.js';
import { filterToParams } from './types.js';

/**
 * Media API methods factory for typed read operations.
 */
export function createMediaMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
) {
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
      const allMedia: WordPressMedia[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 });
        const result = await fetchAPIPaginated<WordPressMedia[]>('/media', params);
        allMedia.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allMedia;
    },

    /**
     * Gets media with pagination metadata.
     */
    async getMediaPaginated(filter: MediaFilter = {}): Promise<PaginatedResponse<WordPressMedia>> {
      const params = filterToParams(filter);
      const result = await fetchAPIPaginated<WordPressMedia[]>('/media', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
