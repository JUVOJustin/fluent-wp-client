import { filterToParams } from './types.js';
/**
 * Tags API methods factory for typed read operations.
 */
export function createTagsMethods(fetchAPI, fetchAPIPaginated) {
    return {
        /**
         * Gets tags with optional filtering.
         */
        async getTags(filter = {}) {
            const params = filterToParams(filter);
            return fetchAPI('/tags', params);
        },
        /**
         * Gets all tags by paginating every page.
         */
        async getAllTags(filter = {}) {
            const allTags = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100 });
                const result = await fetchAPIPaginated('/tags', params);
                allTags.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allTags;
        },
        /**
         * Gets tags with pagination metadata.
         */
        async getTagsPaginated(filter = {}) {
            const params = filterToParams(filter);
            const result = await fetchAPIPaginated('/tags', params);
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
        async getTag(id) {
            return fetchAPI(`/tags/${id}`);
        },
        /**
         * Gets one tag by slug.
         */
        async getTagBySlug(slug) {
            const tags = await fetchAPI('/tags', { slug });
            return tags[0];
        },
    };
}
