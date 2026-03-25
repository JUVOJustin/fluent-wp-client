import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for fluent relation hydration APIs.
 */
describe('Client: post relation hydration', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  function postsClient(client: WordPressClient) {
    return client.content('posts');
  }

  /**
   * Asserts author relation behavior for environments that expose or mask author IDs.
   */
  function expectAuthorRelation(authorId: number, relatedAuthor: { slug?: string } | null): void {
    if (authorId === 0) {
      expect(relatedAuthor).toBeNull();
      return;
    }

    expect(relatedAuthor).toBeTruthy();
    expect(relatedAuthor?.slug).toBe('admin');
  }

  it('hydrates related entities with content(\'posts\').item().with()', async () => {
    const post = await postsClient(authClient).item('test-post-001').with('author', 'terms');

    expect(post.slug).toBe('test-post-001');
    expectAuthorRelation(post.author, post.related.author);
    expect(post.related.terms.categories.length).toBeGreaterThan(0);
    expect(post.related.terms.tags.length).toBeGreaterThan(0);
  });

  it('hydrates relation data with awaitable content(\'posts\').item().with()', async () => {
    const hydrated = await authClient
      .content('posts')
      .item('test-post-002')
      .with('author', 'categories', 'tags', 'featuredMedia');

    expect(hydrated.slug).toBe('test-post-002');
    expectAuthorRelation(hydrated.author, hydrated.related.author);
    expect(Array.isArray(hydrated.related.categories)).toBe(true);
    expect(Array.isArray(hydrated.related.tags)).toBe(true);
    expect(hydrated.related.featuredMedia ?? null).toBeNull();
  });

  it('returns null author relation when public API masks author IDs', async () => {
    const hydrated = await postsClient(publicClient).item('test-post-001').with('author');

    expect(hydrated.author).toBe(0);
    expect(hydrated.related.author).toBeNull();
  });
});
