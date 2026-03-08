import { filterToParams } from './types.js';
/**
 * Pages API methods factory for typed read operations.
 */
export function createPagesMethods(fetchAPI, fetchAPIPaginated) {
    return {
        /**
         * Gets pages with optional filtering (single page, max 100 items).
         */
        async getPages(filter = {}) {
            const params = filterToParams({ ...filter, _embed: 'true' });
            return fetchAPI('/pages', params);
        },
        /**
         * Gets all pages by automatically paginating through all pages.
         */
        async getAllPages(filter = {}) {
            const allPages = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
                const result = await fetchAPIPaginated('/pages', params);
                allPages.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allPages;
        },
        /**
         * Gets pages with pagination metadata.
         */
        async getPagesPaginated(filter = {}) {
            const params = filterToParams({ ...filter, _embed: 'true' });
            const result = await fetchAPIPaginated('/pages', params);
            return {
                data: result.data,
                total: result.total,
                totalPages: result.totalPages,
                page: filter.page || 1,
                perPage: filter.perPage || 100,
            };
        },
        /**
         * Gets one page by ID.
         */
        async getPage(id) {
            return fetchAPI(`/pages/${id}`, { _embed: 'true' });
        },
        /**
         * Gets one page by slug.
         */
        async getPageBySlug(slug) {
            const pages = await fetchAPI('/pages', { slug, _embed: 'true' });
            return pages[0];
        },
    };
}
