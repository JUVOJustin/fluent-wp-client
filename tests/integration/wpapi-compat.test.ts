import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for the WPAPI-inspired query builder syntax.
 */
describe('Client: WPAPI compatibility syntax', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
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

  it('supports namespace-scoped custom resource chains', async () => {
    const books = await publicClient
      .namespace('wp/v2')
      .route('books')
      .slug('test-book-001')
      .get();

    expect(Array.isArray(books)).toBe(true);
    expect((books as Array<{ slug: string }>)[0]?.slug).toBe('test-book-001');
  });

  it('supports registerRoute style factories', () => {
    const bookRoute = publicClient.registerRoute('wp/v2', '/books/(?P<id>)');
    const url = bookRoute().id(123).toString();

    expect(url).toContain('/wp-json/wp/v2/books/123');
  });
});
