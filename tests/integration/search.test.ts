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
      const results = await publicClient.searchContent('test-post');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results with expected shape', async () => {
      const results = await publicClient.searchContent('test-post-001');

      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(typeof first?.id).toBe('number');
      expect(typeof first?.title).toBe('string');
      expect(typeof first?.url).toBe('string');
      expect(typeof first?.type).toBe('string');
      expect(typeof first?.subtype).toBe('string');
    });

    it('finds the expected post by title keyword', async () => {
      const results = await publicClient.searchContent('test-post-001');

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
      const results = await publicClient.searchContent('test-post', {
        type: 'post',
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.type).toBe('post');
      }
    });

    it('respects perPage pagination option', async () => {
      const results = await publicClient.searchContent('test-post', {
        perPage: 3,
      });

      expect(results).toHaveLength(3);
    });

    it('returns an empty array when no results match', async () => {
      const results = await publicClient.searchContent('xyzzy-no-match-fluent-wp-client-test');

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });
  });

  describe('search() WPAPI builder', () => {
    it('returns results via the WPAPI-style search chain', async () => {
      const results = await publicClient
        .search()
        .search('test-post-001')
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(typeof (first as Record<string, unknown>)?.id).toBe('number');
      expect(typeof (first as Record<string, unknown>)?.title).toBe('string');
    });

    it('supports perPage via the WPAPI chain', async () => {
      const results = await publicClient
        .search()
        .search('test-post')
        .perPage(2)
        .get();

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });
  });
});
