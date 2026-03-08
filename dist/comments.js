import { filterToParams } from './types.js';
/**
 * Comments API methods factory for typed read operations.
 */
export function createCommentsMethods(fetchAPI, fetchAPIPaginated) {
    return {
        /**
         * Gets comments with optional filtering.
         */
        async getComments(filter = {}) {
            const params = filterToParams(filter);
            return fetchAPI('/comments', params);
        },
        /**
         * Gets all comments by paginating every page.
         */
        async getAllComments(filter = {}) {
            const allComments = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100 });
                const result = await fetchAPIPaginated('/comments', params);
                allComments.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allComments;
        },
        /**
         * Gets comments with pagination metadata.
         */
        async getCommentsPaginated(filter = {}) {
            const params = filterToParams(filter);
            const result = await fetchAPIPaginated('/comments', params);
            return {
                data: result.data,
                total: result.total,
                totalPages: result.totalPages,
                page: filter.page || 1,
                perPage: filter.perPage || 100,
            };
        },
        /**
         * Gets one comment by ID.
         */
        async getComment(id) {
            return fetchAPI(`/comments/${id}`);
        },
    };
}
