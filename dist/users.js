import { filterToParams } from './types.js';
/**
 * Users API methods factory for typed read operations.
 */
export function createUsersMethods(fetchAPI, fetchAPIPaginated, hasAuth) {
    return {
        /**
         * Gets users with optional filtering.
         */
        async getUsers(filter = {}) {
            const params = filterToParams(filter);
            return fetchAPI('/users', params);
        },
        /**
         * Gets all users by paginating every page.
         */
        async getAllUsers(filter = {}) {
            const allUsers = [];
            let page = 1;
            let totalPages = 1;
            do {
                const params = filterToParams({ ...filter, page, perPage: 100 });
                const result = await fetchAPIPaginated('/users', params);
                allUsers.push(...result.data);
                totalPages = result.totalPages;
                page += 1;
            } while (page <= totalPages);
            return allUsers;
        },
        /**
         * Gets users with pagination metadata.
         */
        async getUsersPaginated(filter = {}) {
            const params = filterToParams(filter);
            const result = await fetchAPIPaginated('/users', params);
            return {
                data: result.data,
                total: result.total,
                totalPages: result.totalPages,
                page: filter.page || 1,
                perPage: filter.perPage || 100,
            };
        },
        /**
         * Gets one user by ID.
         */
        async getUser(id) {
            return fetchAPI(`/users/${id}`);
        },
        /**
         * Gets the currently authenticated user.
         */
        async getCurrentUser() {
            if (!hasAuth()) {
                throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
            }
            return fetchAPI('/users/me');
        },
    };
}
