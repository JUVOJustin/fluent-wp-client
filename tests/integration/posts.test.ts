import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient, createJwtAuthHeader, postSchema } from 'fluent-wp-client';
import { createAuthClient, createJwtAuthClient, createPublicClient, getBaseUrl } from '../helpers/wp-client';

/**
 * Seed data: 150 posts across 5 categories (30 each).
 * Slugs: test-post-001 through test-post-150.
 * WP REST API caps per_page at 100, so getAllPosts() must paginate.
 */
describe('Client: Posts', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let jwtClient: WordPressClient;
  const createdPostIds: number[] = [];

  /**
   * Builds one request-aware auth client for post mutation coverage.
   */
  function createRequestAwarePostClient(): WordPressClient {
    const token = process.env.WP_JWT_TOKEN;

    if (!token) {
      throw new Error('WP_JWT_TOKEN not set - did global-setup run?');
    }

    return new WordPressClient({
      baseUrl: getBaseUrl(),
      authHeaders: ({ method, url }) => {
        if (method !== 'POST') {
          throw new Error('Expected POST for request-aware post auth test.');
        }

        if (!url.pathname.endsWith('/wp-json/wp/v2/posts')) {
          throw new Error('Expected posts endpoint for request-aware post auth test.');
        }

        return {
          Authorization: createJwtAuthHeader(token),
        };
      },
    });
  }

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
    jwtClient = createJwtAuthClient();
  });

  afterAll(async () => {
    for (const id of createdPostIds) {
      await authClient.deletePost(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('getPosts returns an array of posts', async () => {
      const posts = await publicClient.getPosts();

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });

    it('every post has required fields', async () => {
      const posts = await publicClient.getPosts();

      for (const post of posts) {
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('slug');
        expect(post).toHaveProperty('title.rendered');
        expect(post).toHaveProperty('content.rendered');
        expect(post).toHaveProperty('excerpt.rendered');
        expect(post).toHaveProperty('date');
        expect(post).toHaveProperty('status');
      }
    });

    it('getPostBySlug fetches a known seed post', async () => {
      const post = await publicClient.getPostBySlug('test-post-001');

      expect(post).toBeDefined();
      expect(post!.slug).toBe('test-post-001');
      expect(post!.title.rendered).toBe('Test Post 001');
    });

    it('getPostBySlug returns undefined for non-existent slug', async () => {
      const post = await publicClient.getPostBySlug('this-slug-does-not-exist-999');

      expect(post).toBeUndefined();
    });

    it('getAllPosts returns all 150 seed posts (multi-page fetch)', async () => {
      const all = await publicClient.getAllPosts();

      expect(all).toHaveLength(150);
    });

    it('getPostsPaginated returns correct pagination metadata', async () => {
      const result = await publicClient.getPostsPaginated({ perPage: 100, page: 1 });

      expect(result.data).toHaveLength(100);
      expect(result.total).toBe(150);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(100);
    });

    it('getPostsPaginated page 2 returns remaining posts', async () => {
      const result = await publicClient.getPostsPaginated({ perPage: 100, page: 2 });

      expect(result.data).toHaveLength(50);
      expect(result.total).toBe(150);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(2);
    });

    it('getPosts respects ordering', async () => {
      const asc = await publicClient.getPosts({ orderby: 'title', order: 'asc' });
      const desc = await publicClient.getPosts({ orderby: 'title', order: 'desc' });

      expect(asc[0].title.rendered).not.toBe(desc[0].title.rendered);
    });

    it('getPosts embeds featured media data', async () => {
      const posts = await publicClient.getPosts();

      for (const post of posts) {
        expect(post).toHaveProperty('_embedded');
      }
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes posts', async () => {
      const created = await authClient.createPost(
        {
          title: 'Client Posts: create',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.status).toBe('draft');

      const updated = await authClient.updatePost(
        created.id,
        {
          title: 'Client Posts: update',
          status: 'private',
        },
        postSchema,
      );

      expect(updated.title.rendered).toBe('Client Posts: update');
      expect(updated.status).toBe('private');

      const deleted = await authClient.deletePost(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });

    it('creates a post with content and excerpt', async () => {
      const created = await authClient.createPost(
        {
          title: 'Client Posts: content create',
          content: '<p>Hello from client integration test.</p>',
          excerpt: 'Client excerpt',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      expect(created.status).toBe('draft');
      expect(created.content.rendered).toContain('Hello from client integration test.');
      expect(created.excerpt.rendered).toContain('Client excerpt');
    });

    it('creates a post with JWT auth', async () => {
      const created = await jwtClient.createPost(
        {
          title: 'Client Posts: JWT create',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.title.rendered).toBe('Client Posts: JWT create');
    });

    it('creates a post with request-aware auth headers', async () => {
      const requestAwareClient = createRequestAwarePostClient();
      const created = await requestAwareClient.createPost(
        {
          title: 'Client Posts: request-aware create',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.title.rendered).toBe('Client Posts: request-aware create');
    });

    it('throws for unauthenticated post creation', async () => {
      await expect(
        publicClient.createPost({
          title: 'Client Posts: public create',
          status: 'draft',
        }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });

    it('throws for a non-existent post on update', async () => {
      await expect(
        authClient.updatePost(999999, { title: 'Ghost Post' }, postSchema),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });

    it('moves a post to trash when force is omitted', async () => {
      const created = await authClient.createPost(
        {
          title: 'Client Posts: trash',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      const deleted = await authClient.deletePost(created.id);

      expect(deleted.id).toBe(created.id);
      expect(deleted.deleted).toBe(false);
    });

    it('returns a non-deleted result for a non-existent post on delete', async () => {
      const deleted = await authClient.deletePost(999999, { force: true });

      expect(deleted.id).toBe(999999);
      expect(deleted.deleted).toBe(false);
    });
  });
});
