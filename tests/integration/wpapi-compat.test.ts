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
      await authClient.deleteTerm('genre', id, { force: true }).catch(() => undefined);
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
});
