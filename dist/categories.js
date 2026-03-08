import { filterToParams } from './types.js';
/**
 * Categories API methods factory for typed read operations.
 */
export function createCategoriesMethods(fetchAPI, fetchAPIPaginated) {
    return {
        /**
         * Gets categories with optional filtering.
         */
        async getCategories(filter = {}) {
            const params = filterToParams(filter);
            return fetchAPI('/categories', params);
        },
        /**
         * Gets all categories by paginating every page.
         */
        async getAllCategories(filter = {}) {
            const allCategories = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100 });
                const result = await fetchAPIPaginated('/categories', params);
                allCategories.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allCategories;
        },
        /**
         * Gets categories with pagination metadata.
         */
        async getCategoriesPaginated(filter = {}) {
            const params = filterToParams(filter);
            const result = await fetchAPIPaginated('/categories', params);
            return {
                data: result.data,
                total: result.total,
                totalPages: result.totalPages,
                page: filter.page || 1,
                perPage: filter.perPage || 100,
            };
        },
        /**
         * Gets one category by ID.
         */
        async getCategory(id) {
            return fetchAPI(`/categories/${id}`);
        },
        /**
         * Gets one category by slug.
         */
        async getCategoryBySlug(slug) {
            const categories = await fetchAPI('/categories', { slug });
            return categories[0];
        },
    };
}
