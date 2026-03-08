/**
 * Resolves embedded author data when available.
 */
function getEmbeddedAuthor(post) {
    const embedded = post._embedded;
    const authors = embedded?.author;
    if (!Array.isArray(authors) || authors.length === 0) {
        return null;
    }
    return authors[0];
}
/**
 * Resolves one author by preferring direct lookup and then list fallback.
 */
async function resolveAuthor(client, authorId) {
    const direct = await client.getUser(authorId).catch(() => null);
    if (direct) {
        return direct;
    }
    if (!client.getUsers) {
        return null;
    }
    const users = await client.getUsers({ include: [authorId], perPage: 1 }).catch(() => []);
    return users[0] ?? null;
}
/**
 * Resolves embedded featured media data when available.
 */
function getEmbeddedFeaturedMedia(post) {
    const embedded = post._embedded;
    const media = embedded?.['wp:featuredmedia'];
    if (!Array.isArray(media) || media.length === 0) {
        return null;
    }
    return media[0];
}
/**
 * Resolves embedded taxonomy terms by taxonomy name.
 */
function getEmbeddedTerms(post) {
    const embedded = post._embedded;
    const termGroups = embedded?.['wp:term'];
    if (!Array.isArray(termGroups)) {
        return {
            categories: [],
            tags: [],
        };
    }
    const categories = [];
    const tags = [];
    for (const group of termGroups) {
        if (!Array.isArray(group)) {
            continue;
        }
        for (const term of group) {
            if (term.taxonomy === 'category') {
                categories.push(term);
            }
            if (term.taxonomy === 'post_tag') {
                tags.push(term);
            }
        }
    }
    return {
        categories,
        tags,
    };
}
/**
 * Fluent builder that hydrates one post and selected related entities.
 */
export class PostRelationQueryBuilder {
    client;
    selector;
    relationSet;
    constructor(client, selector, relations = []) {
        this.client = client;
        this.selector = selector;
        this.relationSet = new Set(relations);
    }
    /**
     * Adds relation names to the hydration plan.
     */
    with(...relations) {
        const nextRelations = new Set(this.relationSet);
        for (const relation of relations) {
            nextRelations.add(relation);
        }
        return new PostRelationQueryBuilder(this.client, this.selector, Array.from(nextRelations));
    }
    /**
     * Fetches the selected post and resolves requested relations.
     */
    async get() {
        let post;
        if (typeof this.selector.id === 'number') {
            post = await this.client.getPost(this.selector.id);
        }
        if (!post && typeof this.selector.slug === 'string') {
            post = await this.client.getPostBySlug(this.selector.slug);
        }
        if (!post) {
            throw new Error('Post not found for the provided fluent relation selector.');
        }
        const related = {};
        const requestedTerms = this.relationSet.has('terms');
        const requestedCategories = requestedTerms || this.relationSet.has('categories');
        const requestedTags = requestedTerms || this.relationSet.has('tags');
        if (this.relationSet.has('author')) {
            const embeddedAuthor = getEmbeddedAuthor(post);
            related.author = embeddedAuthor ?? await resolveAuthor(this.client, post.author);
        }
        if (this.relationSet.has('featuredMedia')) {
            const embeddedMedia = getEmbeddedFeaturedMedia(post);
            const featuredMediaId = post.featured_media;
            if (embeddedMedia) {
                related.featuredMedia = embeddedMedia;
            }
            else if (typeof featuredMediaId === 'number' && featuredMediaId > 0) {
                related.featuredMedia = await this.client.getMediaItem(featuredMediaId).catch(() => null);
            }
            else {
                related.featuredMedia = null;
            }
        }
        const embeddedTerms = getEmbeddedTerms(post);
        let categories = embeddedTerms.categories;
        let tags = embeddedTerms.tags;
        if (requestedCategories && categories.length === 0 && Array.isArray(post.categories) && post.categories.length > 0) {
            categories = await this.client.getCategories({ include: post.categories }).catch(() => []);
        }
        if (requestedTags && tags.length === 0 && Array.isArray(post.tags) && post.tags.length > 0) {
            tags = await this.client.getTags({ include: post.tags }).catch(() => []);
        }
        if (this.relationSet.has('categories')) {
            related.categories = categories;
        }
        if (this.relationSet.has('tags')) {
            related.tags = tags;
        }
        if (requestedTerms) {
            related.terms = { categories, tags };
        }
        return {
            ...post,
            related: related,
        };
    }
}
