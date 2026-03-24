import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for the WPAPI-inspired query builder syntax.
 */
describe('Client: WPAPI compatibility syntax', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  const createdCategoryIds: number[] = [];
  const createdTagIds: number[] = [];
  const createdGenreIds: number[] = [];

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      await authClient.deleteCategory(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdTagIds) {
      await authClient.deleteTag(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdGenreIds) {
      await authClient.terms('genre').delete(id, { force: true }).catch(() => undefined);
    }
  });

  it('supports chained collection reads with paging and embed', async () => {
    const posts = await publicClient
      .posts()
      .perPage(5)
      .page(1)
      .embed()
      .get();

    expect(Array.isArray(posts)).toBe(true);
    expect(posts).toHaveLength(5);
  });

  it('supports thenable request chains like node-wpapi', async () => {
    const posts = await publicClient.posts().slug('test-post-001');

    expect(Array.isArray(posts)).toBe(true);
    expect(posts[0]?.slug).toBe('test-post-001');
  });

  it('supports create, update, and delete with chained resource syntax', async () => {
    const created = await authClient.posts().create({
      title: 'WPAPI Chain Create',
      status: 'draft',
    });

    const createdId = (created as { id: number }).id;
    expect(createdId).toBeGreaterThan(0);

    const updated = await authClient.posts().id(createdId).update({
      title: 'WPAPI Chain Updated',
      status: 'publish',
    });

    expect((updated as { title: { rendered: string } }).title.rendered).toBe('WPAPI Chain Updated');

    const deleted = await authClient.posts().id(createdId).delete({ force: true });
    expect((deleted as unknown as { deleted: boolean }).deleted).toBe(true);
  });

  it('supports category and tag CRUD with chained term syntax', async () => {
    const createdCategory = await authClient.categories().create({
      name: 'WPAPI Chain Category',
      description: 'Created through the categories() chain.',
    });

    const createdCategoryId = (createdCategory as { id: number }).id;
    createdCategoryIds.push(createdCategoryId);
    expect((createdCategory as { taxonomy: string }).taxonomy).toBe('category');

    const updatedCategory = await authClient.categories().id(createdCategoryId).update({
      name: 'WPAPI Chain Category Updated',
    });

    expect((updatedCategory as { name: string }).name).toBe('WPAPI Chain Category Updated');

    const deletedCategory = await authClient.categories().id(createdCategoryId).delete({ force: true });
    expect((deletedCategory as unknown as { deleted: boolean }).deleted).toBe(true);

    const createdTag = await authClient.tags().create({
      name: 'wpapi-chain-tag',
      description: 'Created through the tags() chain.',
    });

    const createdTagId = (createdTag as { id: number }).id;
    createdTagIds.push(createdTagId);
    expect((createdTag as { taxonomy: string }).taxonomy).toBe('post_tag');

    const updatedTag = await authClient.tags().id(createdTagId).update({
      name: 'wpapi-chain-tag-updated',
    });

    expect((updatedTag as { name: string }).name).toBe('wpapi-chain-tag-updated');

    const deletedTag = await authClient.tags().id(createdTagId).delete({ force: true });
    expect((deletedTag as unknown as { deleted: boolean }).deleted).toBe(true);
  });

  it('supports custom taxonomy CRUD with generic route chains', async () => {
    const createdGenre = await authClient.route('genre').create({
      name: 'WPAPI Chain Genre',
      description: 'Created through the generic route() chain.',
    });

    const createdGenreId = (createdGenre as { id: number }).id;
    createdGenreIds.push(createdGenreId);
    expect((createdGenre as { taxonomy: string }).taxonomy).toBe('genre');

    const updatedGenre = await authClient.route('genre').id(createdGenreId).update({
      name: 'WPAPI Chain Genre Updated',
      slug: 'wpapi-chain-genre-updated',
    });

    expect((updatedGenre as { name: string }).name).toBe('WPAPI Chain Genre Updated');
    expect((updatedGenre as { slug: string }).slug).toBe('wpapi-chain-genre-updated');

    const listedGenres = await authClient.route('genre').slug('wpapi-chain-genre-updated').get();
    expect(Array.isArray(listedGenres)).toBe(true);
    expect((listedGenres as Array<{ id: number }>)[0]?.id).toBe(createdGenreId);

    const deletedGenre = await authClient.route('genre').id(createdGenreId).delete({ force: true });
    expect((deletedGenre as unknown as { deleted: boolean }).deleted).toBe(true);
  });

  it('supports namespace-scoped custom resource chains', async () => {
    const books = await publicClient
      .namespace('wp/v2')
      .route('books')
      .slug('test-book-001')
      .get();

    expect(Array.isArray(books)).toBe(true);
    expect((books as Array<{ slug: string }>)[0]?.slug).toBe('test-book-001');
  });

  it('supports fields() to restrict response payload via _fields', async () => {
    const posts = await publicClient
      .posts()
      .perPage(5)
      .fields(['id', 'slug', 'title'])
      .get();

    expect(Array.isArray(posts)).toBe(true);
    expect((posts as unknown[]).length).toBeGreaterThan(0);

    for (const post of posts as Array<Record<string, unknown>>) {
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('title');
      expect(post).not.toHaveProperty('content');
      expect(post).not.toHaveProperty('excerpt');
    }
  });

  it('supports registerRoute style factories', () => {
    const bookRoute = publicClient.registerRoute('wp/v2', '/books/(?P<id>)');
    const url = bookRoute().id(123).toString();

    expect(url).toContain('/wp-json/wp/v2/books/123');
  });

  describe('search() chain', () => {
    it('filters by type via the search chain', async () => {
      const results = await publicClient
        .search('Test Post')
        .param('type', 'post')
        .perPage(3)
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(3);
      for (const result of results as Array<{ type: string }>) {
        expect(result.type).toBe('post');
      }
    });

    it('filters by a single subtype via the search chain', async () => {
      // WordPress search uses `type` for the resource category ('post', 'term',
      // 'post-format') and `subtype` for the specific post type within that
      // category.  type=post + subtype=page means "pages, which are a post type".
      const results = await publicClient
        .search('about')
        .param('type', 'post')
        .subtype('page')
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (const result of results as Array<{ type: string; subtype: string }>) {
        expect(result.type).toBe('post');
        expect(result.subtype).toBe('page');
      }
    });

    it('filters by multiple subtypes (array) via the search chain', async () => {
      // type=post covers all WordPress post types; subtype narrows to specific
      // ones.  Passing an array uses bracket notation automatically:
      // subtype[]=post&subtype[]=page&subtype[]=book
      const results = await publicClient
        .search('test')
        .param('type', 'post')
        .subtype(['post', 'page', 'book'])
        .perPage(10)
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (const result of results as Array<{ type: string; subtype: string }>) {
        expect(result.type).toBe('post');
        expect(['post', 'page', 'book']).toContain(result.subtype);
      }
    });

    it('respects context via the search chain', async () => {
      const results = await publicClient.search('001').context('embed').get();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects exclude via the search chain', async () => {
      const all = (await publicClient.search('001').get()) as Array<{ id: number }>;

      expect(all.length).toBeGreaterThan(0);
      const firstId = all[0]!.id;

      const filtered = (await publicClient
        .search('001')
        .exclude([firstId])
        .get()) as Array<{ id: number }>;

      expect(filtered.map((r) => r.id)).not.toContain(firstId);
    });

    it('respects include via the search chain', async () => {
      const all = (await publicClient.search('001').get()) as Array<{ id: number }>;

      expect(all.length).toBeGreaterThan(0);
      const firstId = all[0]!.id;

      const included = (await publicClient
        .search('001')
        .include([firstId])
        .get()) as Array<{ id: number }>;

      expect(included.length).toBeGreaterThan(0);
      expect(included.map((r) => r.id)).toContain(firstId);
    });

    it('supports multi-value include arrays via the WPAPI chain', async () => {
      const all = (await publicClient.search('001').get()) as Array<{ id: number }>;

      expect(all.length).toBeGreaterThan(1);
      const ids = all.slice(0, 2).map((result) => result.id);

      const included = (await publicClient
        .search('001')
        .include(ids)
        .get()) as Array<{ id: number }>;

      expect(included.map((result) => result.id).sort((a, b) => a - b)).toEqual(
        [...ids].sort((a, b) => a - b),
      );
    });

    it('supports multi-value exclude arrays via the WPAPI chain', async () => {
      const all = (await publicClient.search('001').get()) as Array<{ id: number }>;

      expect(all.length).toBeGreaterThan(1);
      const ids = all.slice(0, 2).map((result) => result.id);

      const filtered = (await publicClient
        .search('001')
        .exclude(ids)
        .get()) as Array<{ id: number }>;

      expect(filtered.map((result) => result.id)).not.toContain(ids[0]);
      expect(filtered.map((result) => result.id)).not.toContain(ids[1]);
    });
  });
});
