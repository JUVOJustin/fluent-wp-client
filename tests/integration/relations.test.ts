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

  it('hydrates related entities with getPostWithRelations', async () => {
    const post = await authClient.getPostWithRelations('test-post-001', 'author', 'terms');

    expect(post.slug).toBe('test-post-001');
    expectAuthorRelation(post.author, post.related.author);
    expect(post.related.terms.categories.length).toBeGreaterThan(0);
    expect(post.related.terms.tags.length).toBeGreaterThan(0);
  });

  it('hydrates relation data with fluent post().with().get()', async () => {
    const hydrated = await authClient
      .post('test-post-002')
      .with('author', 'categories', 'tags', 'featuredMedia')
      .get();

    expect(hydrated.slug).toBe('test-post-002');
    expectAuthorRelation(hydrated.author, hydrated.related.author);
    expect(Array.isArray(hydrated.related.categories)).toBe(true);
    expect(Array.isArray(hydrated.related.tags)).toBe(true);
    expect(hydrated.related.featuredMedia ?? null).toBeNull();
  });

  it('returns null author relation when public API masks author IDs', async () => {
    const hydrated = await publicClient.getPostWithRelations('test-post-001', 'author');

    expect(hydrated.author).toBe(0);
    expect(hydrated.related.author).toBeNull();
  });
});
