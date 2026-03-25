import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration tests for relationship field requirements.
 * 
 * These tests ensure that when using relationship hydration methods,
 * critical fields (_embed data and ID fields) are automatically preserved
 * even when users attempt to restrict the field set via the `fields` filter.
 */
describe('Client: relationship field requirements', () => {
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

  describe('automatic field preservation for relations', () => {
    it('hydrates relations without exposing _embedded by default', async () => {
      // Relationship hydration works via _embedded internally, but it's stripped from output
      const post = await postsClient(authClient).item('test-post-001').with('author', 'terms');

      expect(post.slug).toBe('test-post-001');
      // _embedded should NOT be present by default (lean output)
      expect(post).not.toHaveProperty('_embedded');
      // But related data IS populated
      expectAuthorRelation(post.author, post.related.author);
      expect(post.related.terms.categories.length).toBeGreaterThan(0);
    });

    it('includes _embedded data when embed: true is explicitly requested', async () => {
      const post = await authClient
        .content('posts')
        .item('test-post-002', { embed: true })
        .with('author', 'categories', 'tags');

      expect(post.slug).toBe('test-post-002');
      // _embedded should be present when explicitly requested
      expect(post).toHaveProperty('_embedded');
      expectAuthorRelation(post.author, post.related.author);
      expect(Array.isArray(post.related.categories)).toBe(true);
      expect(Array.isArray(post.related.tags)).toBe(true);
    });

    it('preserves author field when requesting author relation', async () => {
      // The author ID field is required to fetch author details if _embedded fails
      const post = await postsClient(authClient).item('test-post-003').with('author');

      // author field should be present (number or 0)
      expect(typeof post.author).toBe('number');
      expectAuthorRelation(post.author, post.related.author);
    });

    it('preserves categories field when requesting categories relation', async () => {
      const post = await postsClient(authClient).item('test-post-004').with('categories');

      // categories array should be present for fallback fetching
      expect(post).toHaveProperty('categories');
      expect(Array.isArray(post.categories)).toBe(true);
      expect(post.categories.length).toBeGreaterThan(0);
      expect(Array.isArray(post.related.categories)).toBe(true);
    });

    it('preserves tags field when requesting tags relation', async () => {
      const post = await postsClient(authClient).item('test-post-005').with('tags');

      // tags array should be present for fallback fetching
      expect(post).toHaveProperty('tags');
      expect(Array.isArray(post.tags)).toBe(true);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(Array.isArray(post.related.tags)).toBe(true);
    });

    it('preserves featured_media field when requesting featuredMedia relation', async () => {
      const post = await postsClient(authClient).item('test-post-006').with('featuredMedia');

      // featured_media field should be present
      expect(post).toHaveProperty('featured_media');
      expect(typeof post.featured_media).toBe('number');
    });
  });

  describe('embedded data handling with relations', () => {
    it('keeps plain item() payloads lean until relations are requested', async () => {
      const post = await postsClient(authClient).item('test-post-001');

      expect(post).not.toHaveProperty('_embedded');
      expect(post).toHaveProperty('author');
      expect(post).toHaveProperty('categories');
      expect(post).toHaveProperty('tags');
    });

    it('falls back to separate requests when _embedded is missing but IDs are present', async () => {
      // If _embedded is not available, the system uses ID fields to fetch relations
      // This tests the fallback mechanism works when required ID fields are present
      const post = await postsClient(authClient).item('test-post-007').with('author');

      // Should have the author relation resolved
      expectAuthorRelation(post.author, post.related.author);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles posts without categories gracefully', async () => {
      // Some posts might not have categories - ensure this doesn't break
      const post = await postsClient(authClient).item('test-post-008').with('categories');

      expect(post).toHaveProperty('categories');
      expect(Array.isArray(post.categories)).toBe(true);
      // related.categories should be an array even if empty
      expect(Array.isArray(post.related.categories)).toBe(true);
    });

    it('handles posts without tags gracefully', async () => {
      const post = await postsClient(authClient).item('test-post-009').with('tags');

      expect(post).toHaveProperty('tags');
      expect(Array.isArray(post.tags)).toBe(true);
      expect(Array.isArray(post.related.tags)).toBe(true);
    });

    it('handles posts without featured media gracefully', async () => {
      const post = await postsClient(authClient).item('test-post-010').with('featuredMedia');

      expect(post).toHaveProperty('featured_media');
      // Should resolve to null when no featured media
      expect(post.related.featuredMedia === null || typeof post.related.featuredMedia === 'object').toBe(true);
    });

    it('handles multiple relations with partial embedded data', async () => {
      // Request multiple relations - some may have embedded data, others may need fallback
      const post = await postsClient(authClient)
        .item('test-post-011')
        .with('author', 'categories', 'tags', 'featuredMedia');

      expect(post.slug).toBe('test-post-011');
      expectAuthorRelation(post.author, post.related.author);
      expect(Array.isArray(post.related.categories)).toBe(true);
      expect(Array.isArray(post.related.tags)).toBe(true);
      // featuredMedia may be null or an object
      expect(post.related.featuredMedia === null || typeof post.related.featuredMedia === 'object').toBe(true);
    });
  });

  describe('public client behavior (no auth)', () => {
    it('returns null for author when public API masks author IDs but preserves field structure', async () => {
      const post = await postsClient(publicClient).item('test-post-012').with('author');

      // author field should still be present (value 0 for masked)
      expect(post).toHaveProperty('author');
      expect(post.author).toBe(0);
      expect(post.related.author).toBeNull();
    });

    it('still provides categories and tags for public client', async () => {
      const post = await postsClient(publicClient).item('test-post-013').with('categories', 'tags');

      // These should work even without auth
      expect(Array.isArray(post.related.categories)).toBe(true);
      expect(post.related.categories.length).toBeGreaterThan(0);
      expect(Array.isArray(post.related.tags)).toBe(true);
      expect(post.related.tags.length).toBeGreaterThan(0);
    });
  });
});
