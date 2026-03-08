import type { WordPressMedia } from './schemas.js';
import type { FetchResult, MediaFilter, PaginatedResponse } from './types.js';
/**
 * Media API methods factory for typed read operations.
 */
export declare function createMediaMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>): {
    /**
     * Gets media items with optional filtering.
     */
    getMedia(filter?: MediaFilter): Promise<WordPressMedia[]>;
    /**
     * Gets all media items by paginating every page.
     */
    getAllMedia(filter?: Omit<MediaFilter, "page">): Promise<WordPressMedia[]>;
    /**
     * Gets media with pagination metadata.
     */
    getMediaPaginated(filter?: MediaFilter): Promise<PaginatedResponse<WordPressMedia>>;
    /**
     * Gets one media item by ID.
     */
    getMediaItem(id: number): Promise<WordPressMedia>;
    /**
     * Gets one media item by slug.
     */
    getMediaBySlug(slug: string): Promise<WordPressMedia | undefined>;
    /**
     * Gets one image URL for a specific media size key.
     */
    getImageUrl(media: WordPressMedia, size?: string): string;
};
