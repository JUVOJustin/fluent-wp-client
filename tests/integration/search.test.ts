import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for the cross-resource `/wp/v2/search` endpoint.
 *
 * Seed data: 150 posts (test-post-001 through test-post-150),
 * 10 pages (about, contact, services, etc.), and 10 books (test-book-001 through test-book-010).
 */
describe('Client: Search', () => {
  let publicClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
  });

  describe('searchContent()', () => {
    it('returns an array of search results', async () => {
      // Search for "Test Post" (with space) to match post titles
      const results = await publicClient.searchContent('Test Post');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results with expected shape', async () => {
      const results = await publicClient.searchContent('001');

      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(typeof first?.id).toBe('number');
      expect(typeof first?.title).toBe('string');
      expect(typeof first?.url).toBe('string');
      expect(typeof first?.type).toBe('string');
      expect(typeof first?.subtype).toBe('string');
    });

    it('finds the expected post by title keyword', async () => {
      const results = await publicClient.searchContent('001');

      const match = results.find((r) => r.title === 'Test Post 001');
      expect(match).toBeDefined();
      expect(match?.type).toBe('post');
      expect(match?.subtype).toBe('post');
    });

    it('finds pages when filtering by type and subtype', async () => {
      const results = await publicClient.searchContent('about', {
        type: 'post',
        subtype: 'page',
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.type).toBe('post');
        expect(result.subtype).toBe('page');
      }
    });

    it('filters by type=post', async () => {
      // Search for "Test Post" (with space) to match post titles
      const results = await publicClient.searchContent('Test Post', {
        type: 'post',
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.type).toBe('post');
      }
    });

    it('respects perPage pagination option', async () => {
      // Search for "Test Post" (with space) to match post titles
      const results = await publicClient.searchContent('Test Post', {
        perPage: 3,
      });

      expect(results).toHaveLength(3);
    });

    it('returns an empty array when no results match', async () => {
      const results = await publicClient.searchContent('xyzzy-no-match-fluent-wp-client-test');

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });

    it('filters by multiple subtypes using an array (bracket notation)', async () => {
      // 'about' matches the seeded About page; supplying both post and page
      // subtypes ensures the bracket-notation serialization is exercised.
      const results = await publicClient.searchContent('about', {
        type: 'post',
        subtype: ['post', 'page'],
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.type).toBe('post');
        expect(['post', 'page']).toContain(result.subtype);
      }
    });

    it('supports searching across posts, pages, and books with array subtype', async () => {
      // Reproduces the exact example from the issue:
      // /wp/v2/search?search=test&type=post&subtype[]=post&subtype[]=page&subtype[]=book
      const results = await publicClient.searchContent('test', {
        type: 'post',
        subtype: ['post', 'page', 'book'],
        perPage: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.type).toBe('post');
        expect(['post', 'page', 'book']).toContain(result.subtype);
      }
    });

    it('respects the context param', async () => {
      const results = await publicClient.searchContent('001', {
        context: 'embed',
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects the exclude param to omit specific IDs', async () => {
      // First fetch without exclusion to get a real ID.
      const all = await publicClient.searchContent('001');
      expect(all.length).toBeGreaterThan(0);
      const firstId = all[0]!.id;

      // Now exclude that ID and verify it is absent from the results.
      const filtered = await publicClient.searchContent('001', {
        exclude: [firstId],
      });

      const ids = filtered.map((r) => r.id);
      expect(ids).not.toContain(firstId);
    });

    it('respects the include param to fetch specific IDs', async () => {
      // First fetch to obtain a real ID.
      const all = await publicClient.searchContent('001');
      expect(all.length).toBeGreaterThan(0);
      const firstId = all[0]!.id;

      const included = await publicClient.searchContent('001', {
        include: [firstId],
      });

      expect(included.length).toBeGreaterThan(0);
      expect(included.map((r) => r.id)).toContain(firstId);
    });

    it('supports multi-value include arrays without normalization', async () => {
      const all = await publicClient.searchContent('001');
      expect(all.length).toBeGreaterThan(1);
      const ids = all.slice(0, 2).map((result) => result.id);

      const included = await publicClient.searchContent('001', {
        include: ids,
      });

      expect(included.map((result) => result.id).sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
    });

    it('supports multi-value exclude arrays without normalization', async () => {
      const all = await publicClient.searchContent('001');
      expect(all.length).toBeGreaterThan(1);
      const ids = all.slice(0, 2).map((result) => result.id);

      const filtered = await publicClient.searchContent('001', {
        exclude: ids,
      });

      expect(filtered.map((result) => result.id)).not.toContain(ids[0]);
      expect(filtered.map((result) => result.id)).not.toContain(ids[1]);
    });
  });

  describe('search() WPAPI builder', () => {
    it('returns results via the WPAPI-style search chain', async () => {
      const results = await publicClient
        .search()
        .search('001')
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(typeof (first as Record<string, unknown>)?.id).toBe('number');
      expect(typeof (first as Record<string, unknown>)?.title).toBe('string');
    });

    it('supports perPage via the WPAPI chain', async () => {
      // Search for "Test Post" (with space) to match post titles
      const results = await publicClient
        .search()
        .search('Test Post')
        .perPage(2)
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });
  });
});
