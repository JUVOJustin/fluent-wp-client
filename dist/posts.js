import { filterToParams } from './types.js';
/**
 * Posts API methods factory for typed read operations.
 */
export function createPostsMethods(fetchAPI, fetchAPIPaginated) {
    return {
        /**
         * Gets posts with optional filtering (single page, max 100 items).
         */
        async getPosts(filter = {}) {
            const params = filterToParams({ ...filter, _embed: 'true' });
            return fetchAPI('/posts', params);
        },
        /**
         * Gets all posts by automatically paginating through all pages.
         */
        async getAllPosts(filter = {}) {
            const allPosts = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
                const result = await fetchAPIPaginated('/posts', params);
                allPosts.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allPosts;
        },
        /**
         * Gets posts with pagination metadata.
         */
        async getPostsPaginated(filter = {}) {
            const params = filterToParams({ ...filter, _embed: 'true' });
            const result = await fetchAPIPaginated('/posts', params);
            return {
                data: result.data,
                total: result.total,
                totalPages: result.totalPages,
                page: filter.page || 1,
                perPage: filter.perPage || 100,
            };
        },
        /**
         * Gets one post by ID.
         */
        async getPost(id) {
            return fetchAPI(`/posts/${id}`, { _embed: 'true' });
        },
        /**
         * Gets one post by slug.
         */
        async getPostBySlug(slug) {
            const posts = await fetchAPI('/posts', { slug, _embed: 'true' });
            return posts[0];
        },
    };
}
