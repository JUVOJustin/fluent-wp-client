import { compactPayload, filterToParams, } from './types.js';
/**
 * Creates generic content and taxonomy method groups used by the main client.
 */
export function createContentTermMethods(dependencies) {
    /**
     * Lists one content resource (posts/pages/custom post types).
     */
    async function getContentCollection(resource, filter = {}) {
        const params = filterToParams({ ...filter, _embed: 'true' });
        return dependencies.fetchAPI(`/${resource}`, params);
    }
    /**
     * Lists all items from one content resource using automatic pagination.
     */
    async function getAllContentCollection(resource, filter = {}) {
        const allItems = [];
        let page = 1;
        let totalPages = 1;
        do {
            const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
            const result = await dependencies.fetchAPIPaginated(`/${resource}`, params);
            allItems.push(...result.data);
            totalPages = result.totalPages;
            page += 1;
        } while (page <= totalPages);
        return allItems;
    }
    /**
     * Lists one content resource with pagination metadata.
     */
    async function getContentCollectionPaginated(resource, filter = {}) {
        const params = filterToParams({ ...filter, _embed: 'true' });
        const result = await dependencies.fetchAPIPaginated(`/${resource}`, params);
        return {
            data: result.data,
            total: result.total,
            totalPages: result.totalPages,
            page: typeof filter.page === 'number' ? filter.page : 1,
            perPage: typeof filter.perPage === 'number' ? filter.perPage : 100,
        };
    }
    /**
     * Fetches one content item by numeric ID.
     */
    async function getContent(resource, id) {
        return dependencies.fetchAPI(`/${resource}/${id}`, { _embed: 'true' });
    }
    /**
     * Fetches one content item by slug.
     */
    async function getContentBySlug(resource, slug) {
        const items = await dependencies.fetchAPI(`/${resource}`, { slug, _embed: 'true' });
        return items[0];
    }
    /**
     * Creates one content item for any post-like REST resource.
     */
    async function createContent(resource, input, responseSchema) {
        return dependencies.executeMutation({
            endpoint: `/${resource}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema);
    }
    /**
     * Updates one content item for any post-like REST resource.
     */
    async function updateContent(resource, id, input, responseSchema) {
        return dependencies.executeMutation({
            endpoint: `/${resource}/${id}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema);
    }
    /**
     * Deletes one content item for any post-like REST resource.
     */
    async function deleteContent(resource, id, options = {}) {
        const params = options.force ? { force: 'true' } : undefined;
        const { data } = await dependencies.request({
            endpoint: `/${resource}/${id}`,
            method: 'DELETE',
            params,
        });
        if (typeof data === 'object'
            && data !== null
            && 'deleted' in data
            && data.deleted === true) {
            return {
                id,
                deleted: true,
                previous: data.previous,
            };
        }
        return { id, deleted: false };
    }
    /**
     * Lists one taxonomy term resource.
     */
    async function getTermCollection(resource, filter = {}) {
        const params = filterToParams(filter);
        return dependencies.fetchAPI(`/${resource}`, params);
    }
    /**
     * Lists all items from one taxonomy term resource.
     */
    async function getAllTermCollection(resource, filter = {}) {
        const allItems = [];
        let page = 1;
        let totalPages = 1;
        do {
            const params = filterToParams({ ...filter, page, perPage: 100 });
            const result = await dependencies.fetchAPIPaginated(`/${resource}`, params);
            allItems.push(...result.data);
            totalPages = result.totalPages;
            page += 1;
        } while (page <= totalPages);
        return allItems;
    }
    /**
     * Lists one taxonomy term resource with pagination metadata.
     */
    async function getTermCollectionPaginated(resource, filter = {}) {
        const params = filterToParams(filter);
        const result = await dependencies.fetchAPIPaginated(`/${resource}`, params);
        return {
            data: result.data,
            total: result.total,
            totalPages: result.totalPages,
            page: typeof filter.page === 'number' ? filter.page : 1,
            perPage: typeof filter.perPage === 'number' ? filter.perPage : 100,
        };
    }
    /**
     * Fetches one term by numeric ID.
     */
    async function getTerm(resource, id) {
        return dependencies.fetchAPI(`/${resource}/${id}`);
    }
    /**
     * Fetches one term by slug.
     */
    async function getTermBySlug(resource, slug) {
        const items = await dependencies.fetchAPI(`/${resource}`, { slug });
        return items[0];
    }
    /**
     * Creates one term for any taxonomy resource.
     */
    async function createTerm(resource, input, responseSchema) {
        return dependencies.executeMutation({
            endpoint: `/${resource}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema);
    }
    /**
     * Updates one term for any taxonomy resource.
     */
    async function updateTerm(resource, id, input, responseSchema) {
        return dependencies.executeMutation({
            endpoint: `/${resource}/${id}`,
            method: 'POST',
            body: compactPayload(input),
        }, responseSchema);
    }
    /**
     * Deletes one term for any taxonomy resource.
     */
    async function deleteTerm(resource, id, options = {}) {
        const params = options.force ? { force: 'true' } : undefined;
        const { data } = await dependencies.request({
            endpoint: `/${resource}/${id}`,
            method: 'DELETE',
            params,
        });
        if (typeof data === 'object'
            && data !== null
            && 'deleted' in data
            && data.deleted === true) {
            return {
                id,
                deleted: true,
                previous: data.previous,
            };
        }
        return {
            id,
            deleted: false,
        };
    }
    /**
     * Builds one typed generic content resource client.
     */
    function content(resource, responseSchema) {
        return {
            list: (filter = {}) => getContentCollection(resource, filter),
            listAll: (filter = {}) => getAllContentCollection(resource, filter),
            listPaginated: (filter = {}) => getContentCollectionPaginated(resource, filter),
            getById: (id) => getContent(resource, id),
            getBySlug: (slug) => getContentBySlug(resource, slug),
            create: (input) => createContent(resource, input, responseSchema),
            update: (id, input) => updateContent(resource, id, input, responseSchema),
            delete: (id, options) => deleteContent(resource, id, options),
        };
    }
    /**
     * Builds one typed generic term resource client.
     */
    function terms(resource, responseSchema) {
        return {
            list: (filter = {}) => getTermCollection(resource, filter),
            listAll: (filter = {}) => getAllTermCollection(resource, filter),
            listPaginated: (filter = {}) => getTermCollectionPaginated(resource, filter),
            getById: (id) => getTerm(resource, id),
            getBySlug: (slug) => getTermBySlug(resource, slug),
            create: (input) => createTerm(resource, input, responseSchema),
            update: (id, input) => updateTerm(resource, id, input, responseSchema),
            delete: (id, options) => deleteTerm(resource, id, options),
        };
    }
    return {
        getContentCollection,
        getAllContentCollection,
        getContentCollectionPaginated,
        getContent,
        getContentBySlug,
        createContent,
        updateContent,
        deleteContent,
        getTermCollection,
        getAllTermCollection,
        getTermCollectionPaginated,
        getTerm,
        getTermBySlug,
        createTerm,
        updateTerm,
        deleteTerm,
        content,
        terms,
    };
}
