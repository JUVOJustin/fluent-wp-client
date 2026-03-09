import type { WordPressMedia } from './schemas.js';
import type { FetchResult, MediaFilter, PaginatedResponse } from './types.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';
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
      return fetchAllPaginatedItems<WordPressMedia>({
        fetchPage: (page, perPage) => {
          const params = filterToParams({ ...filter, page, perPage });
          return fetchAPIPaginated<WordPressMedia[]>('/media', params);
        },
      });
    },

    /**
     * Gets media with pagination metadata.
     */
    async getMediaPaginated(filter: MediaFilter = {}): Promise<PaginatedResponse<WordPressMedia>> {
      const page = filter.page || 1;
      const perPage = filter.perPage || 100;

      return fetchPaginatedResponse<WordPressMedia>({
        runtime: {
          fetchPage: (currentPage, currentPerPage) => {
            const params = filterToParams({ ...filter, page: currentPage, perPage: currentPerPage });
            return fetchAPIPaginated<WordPressMedia[]>('/media', params);
          },
        },
        page,
        perPage,
      });
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
