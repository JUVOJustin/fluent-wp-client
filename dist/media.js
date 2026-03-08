import { filterToParams } from './types.js';
/**
 * Media API methods factory for typed read operations.
 */
export function createMediaMethods(fetchAPI, fetchAPIPaginated) {
    return {
        /**
         * Gets media items with optional filtering.
         */
        async getMedia(filter = {}) {
            const params = filterToParams(filter);
            return fetchAPI('/media', params);
        },
        /**
         * Gets all media items by paginating every page.
         */
        async getAllMedia(filter = {}) {
            const allMedia = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100 });
                const result = await fetchAPIPaginated('/media', params);
                allMedia.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allMedia;
        },
        /**
         * Gets media with pagination metadata.
         */
        async getMediaPaginated(filter = {}) {
            const params = filterToParams(filter);
            const result = await fetchAPIPaginated('/media', params);
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
        async getMediaItem(id) {
            return fetchAPI(`/media/${id}`);
        },
        /**
         * Gets one media item by slug.
         */
        async getMediaBySlug(slug) {
            const media = await fetchAPI('/media', { slug });
            return media[0];
        },
        /**
         * Gets one image URL for a specific media size key.
         */
        getImageUrl(media, size = 'full') {
            if (size === 'full' || !media.media_details.sizes[size]) {
                return media.source_url;
            }
            return media.media_details.sizes[size].source_url;
        },
    };
}
