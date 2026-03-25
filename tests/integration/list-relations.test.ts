import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration tests for fluent list relation hydration.
 * 
 * These tests verify that .list().with() works correctly and returns
 * serializable DTOs with hydrated relations.
 */
describe('Client: fluent list relation hydration', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  describe('list().with() fluent API', () => {
    it('returns plain array when awaited directly (no relations)', async () => {
      const posts = await publicClient.content('posts').list({ perPage: 3 });

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBe(3);
      
      // Should not have .related property when no relations requested
      expect(posts[0]).not.toHaveProperty('related');
    });

    it('hydrates relations when .with() is called', async () => {
      const posts = await publicClient
        .content('posts')
        .list({ perPage: 2 })
        .with('categories', 'tags');

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBe(2);

      // Each post should have .related with categories and tags
      for (const post of posts) {
        expect(post).toHaveProperty('related');
        expect(post.related).toHaveProperty('categories');
        expect(post.related).toHaveProperty('tags');
        expect(Array.isArray(post.related.categories)).toBe(true);
        expect(Array.isArray(post.related.tags)).toBe(true);
      }
    });

    it('returns serializable DTOs (structuredClone-safe)', async () => {
      const posts = await publicClient
        .content('posts')
        .list({ perPage: 1 })
        .with('categories');

      const cloned = structuredClone(posts);

      expect(cloned[0].id).toBe(posts[0].id);
      expect(cloned[0].slug).toBe(posts[0].slug);
      expect(Array.isArray(cloned[0].related.categories)).toBe(true);
    });

    it('returns serializable DTOs (JSON round-trip)', async () => {
      const posts = await publicClient
        .content('posts')
        .list({ perPage: 1 })
        .with('categories');

      const json = JSON.stringify(posts);
      const parsed = JSON.parse(json);

      expect(parsed[0].slug).toBe(posts[0].slug);
      expect(parsed[0].title.rendered).toBe(posts[0].title.rendered);
      expect(Array.isArray(parsed[0].related.categories)).toBe(true);
    });

    it('resolved data has no thenable or helper methods', async () => {
      const posts = await publicClient
        .content('posts')
        .list({ perPage: 1 })
        .with('categories');

      const first = posts[0];

      expect('then' in first).toBe(false);
      expect('get' in first).toBe(false);
      expect('with' in first).toBe(false);
    });

    it('builder can be awaited directly', async () => {
      const builder = publicClient.content('posts').list({ perPage: 1 }).with('categories');
      
      // Builder should be thenable
      expect(typeof builder.then).toBe('function');
      
      // Can await directly
      const posts = await builder;
      
      expect(Array.isArray(posts)).toBe(true);
      expect(posts[0]).toHaveProperty('related');
    });

    it('can chain multiple .with() calls', async () => {
      const posts = await publicClient
        .content('posts')
        .list({ perPage: 1 })
        .with('categories')
        .with('tags');

      expect(posts[0].related).toHaveProperty('categories');
      expect(posts[0].related).toHaveProperty('tags');
    });
  });

  describe('listAll().with() fluent API', () => {
    it('hydrates relations for all items', async () => {
      const posts = await publicClient
        .content('posts')
        .listAll({ perPage: 10 })
        .with('categories');

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);

      // All posts should have hydrated categories
      for (const post of posts.slice(0, 5)) {
        expect(post).toHaveProperty('related');
        expect(Array.isArray(post.related.categories)).toBe(true);
      }
    });
  });

  describe('listPaginated().with() fluent API', () => {
    it('hydrates relations within paginated response', async () => {
      const result = await publicClient
        .content('posts')
        .listPaginated({ perPage: 3, page: 1 })
        .with('categories');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.data)).toBe(true);

      // Data items should have relations
      for (const post of result.data) {
        expect(post).toHaveProperty('related');
        expect(Array.isArray(post.related.categories)).toBe(true);
      }
    });
  });
});
