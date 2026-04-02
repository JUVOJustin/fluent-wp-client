import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  WordPressClient,
  createJwtAuthHeader,
  postSchema,
  type ContentResourceClient,
  type ExtensibleFilter,
  type PostsFilter,
  type WordPressPost,
  type WordPressPostWriteBase,
} from 'fluent-wp-client';
import { createAuthClient, createJwtAuthClient, createPublicClient, getBaseUrl } from '../helpers/wp-client';

/**
 * Seed data: 150 posts across 5 categories (30 each).
 * Slugs: test-post-001 through test-post-150.
 * WP REST API caps per_page at 100, so `content('posts').listAll()` must paginate.
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

  function postsClient(
    client: WordPressClient,
  ): ContentResourceClient<
    WordPressPost,
    ExtensibleFilter<PostsFilter>,
    WordPressPostWriteBase,
    WordPressPostWriteBase
  > {
    return client.content('posts');
  }

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
    jwtClient = createJwtAuthClient();
  });

  afterAll(async () => {
    for (const id of createdPostIds) {
      await postsClient(authClient).delete(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('content(\'posts\').list() returns an array of posts', async () => {
      const posts = await postsClient(publicClient).list();

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
    });

    it('every post has required fields', async () => {
      const posts = await postsClient(publicClient).list();

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

    it('content(\'posts\').item() fetches a known seed post', async () => {
      const post = await postsClient(publicClient).item('test-post-001');

      expect(post).toBeDefined();
      expect(post!.slug).toBe('test-post-001');
      expect(post!.title.rendered).toBe('Test Post 001');
    });

    it('content(\'posts\').item() returns undefined for non-existent slug', async () => {
      const post = await postsClient(publicClient).item('this-slug-does-not-exist-999');

      expect(post).toBeUndefined();
    });



    it('content(\'posts\').listAll() returns all 150 seed posts', async () => {
      const all = await postsClient(publicClient).listAll();

      expect(all).toHaveLength(150);
    });

    it('content(\'posts\').listPaginated() returns correct pagination metadata', async () => {
      const result = await postsClient(publicClient).listPaginated({ perPage: 100, page: 1 });

      expect(result.data).toHaveLength(100);
      expect(result.total).toBe(150);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(100);
    });

    it('content(\'posts\').listPaginated() page 2 returns remaining posts', async () => {
      const result = await postsClient(publicClient).listPaginated({ perPage: 100, page: 2 });

      expect(result.data).toHaveLength(50);
      expect(result.total).toBe(150);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(2);
    });

    it('content(\'posts\').list() respects ordering', async () => {
      const asc = await postsClient(publicClient).list({ orderby: 'title', order: 'asc' });
      const desc = await postsClient(publicClient).list({ orderby: 'title', order: 'desc' });

      expect(asc[0].title.rendered).not.toBe(desc[0].title.rendered);
    });

    it('content(\'posts\').list() omits embedded data by default', async () => {
      const posts = await postsClient(publicClient).list();

      for (const post of posts) {
        expect(post).not.toHaveProperty('_embedded');
      }
    });

    it('content(\'posts\').list() supports opt-in embedded data', async () => {
      const posts = await postsClient(publicClient).list({ perPage: 5, embed: true });

      expect(posts).toHaveLength(5);

      for (const post of posts) {
        expect(post).toHaveProperty('_embedded');
      }
    });

    it('content(\'posts\').list() supports the search parameter', async () => {
      const posts = await postsClient(publicClient).list({ search: 'Test Post 001' });

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
      expect(posts[0]?.title.rendered).toContain('Test Post 001');
    });

    it('content(\'posts\').list() supports include arrays on collection endpoints', async () => {
      const first = await postsClient(publicClient).item('test-post-001');
      const second = await postsClient(publicClient).item('test-post-002');

      expect(first).toBeDefined();
      expect(second).toBeDefined();

      const posts = await postsClient(publicClient).list({
        include: [first!.id, second!.id],
        orderby: 'include',
      });

      expect(posts.map((post) => post.id)).toEqual([first!.id, second!.id]);
    });

    it('content(\'posts\').list() supports exclude arrays on collection endpoints', async () => {
      const first = await postsClient(publicClient).item('test-post-001');
      const second = await postsClient(publicClient).item('test-post-002');

      expect(first).toBeDefined();
      expect(second).toBeDefined();

      const posts = await postsClient(publicClient).list({
        search: 'Test Post',
        exclude: [first!.id, second!.id],
      });

      expect(posts.map((post) => post.id)).not.toContain(first!.id);
      expect(posts.map((post) => post.id)).not.toContain(second!.id);
    });

    it('content(\'posts\').list() supports slug arrays on collection endpoints', async () => {
      const posts = await postsClient(publicClient).list({
        slug: ['test-post-001', 'test-post-002'],
      });

      expect(posts.map((post) => post.slug).sort()).toEqual(['test-post-001', 'test-post-002']);
    });

    it('content(\'posts\').list() supports offset on collection endpoints', async () => {
      const firstPage = await postsClient(publicClient).list({
        orderby: 'id',
        order: 'asc',
        perPage: 2,
      });

      const offsetPage = await postsClient(publicClient).list({
        orderby: 'id',
        order: 'asc',
        perPage: 1,
        offset: 1,
      });

      expect(firstPage).toHaveLength(2);
      expect(offsetPage).toHaveLength(1);
      expect(offsetPage[0]?.id).toBe(firstPage[1]?.id);
    });

    it('content(\'posts\').list() supports custom registered collection filters', async () => {
      const posts = await postsClient(publicClient).list({
        titleSearch: 'Test Post 001',
      });

      expect(posts.length).toBeGreaterThan(0);
      expect(posts[0]?.title.rendered).toContain('Test Post 001');
    });

    it('content(\'posts\').listAll() supports the search parameter', async () => {
      // There are 150 posts all matching 'test-post'; restricting via category
      // keeps the count predictable (30 Technology posts).
      const posts = await postsClient(publicClient).listAll({ search: 'Test Post 001' });

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
      for (const post of posts) {
        expect(post.title.rendered).toContain('Test Post 001');
      }
    });

    it('content(\'posts\').listAll() preserves ordering with parallel pagination', async () => {
      // Fetch all posts ordered by ID ascending
      const postsAsc = await postsClient(publicClient).listAll({
        orderby: 'id',
        order: 'asc',
      });

      // Verify we got all 150 posts
      expect(postsAsc).toHaveLength(150);

      // Verify ascending order - each ID should be greater than the previous
      for (let i = 1; i < postsAsc.length; i++) {
        expect(postsAsc[i]!.id).toBeGreaterThan(postsAsc[i - 1]!.id);
      }

      // Fetch all posts ordered by ID descending
      const postsDesc = await postsClient(publicClient).listAll({
        orderby: 'id',
        order: 'desc',
      });

      // Verify we got all 150 posts
      expect(postsDesc).toHaveLength(150);

      // Verify descending order - each ID should be less than the previous
      for (let i = 1; i < postsDesc.length; i++) {
        expect(postsDesc[i]!.id).toBeLessThan(postsDesc[i - 1]!.id);
      }

      // Verify that ascending and descending give us opposite orders
      expect(postsAsc[0]!.id).toBeLessThan(postsDesc[0]!.id);
      expect(postsAsc[postsAsc.length - 1]!.id).toBeGreaterThan(postsDesc[postsDesc.length - 1]!.id);
    });

    it('content(\'posts\').list() with fields filter returns only requested fields', async () => {
      const posts = await postsClient(publicClient).list({ fields: ['id', 'slug', 'title'], perPage: 5 });

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);

      for (const post of posts) {
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('slug');
        expect(post).toHaveProperty('title');
        // Fields not requested should be absent
        expect(post).not.toHaveProperty('content');
        expect(post).not.toHaveProperty('excerpt');
      }
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes posts', async () => {
      const created = await postsClient(authClient).create(
        {
          title: 'Client Posts: create',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.status).toBe('draft');

      const updated = await postsClient(authClient).update(
        created.id,
        {
          title: 'Client Posts: update',
          status: 'private',
        },
        postSchema,
      );

      expect(updated.title.rendered).toBe('Client Posts: update');
      expect(updated.status).toBe('private');

      const deleted = await postsClient(authClient).delete(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });

    it('creates a post with content and excerpt', async () => {
      const created = await postsClient(authClient).create(
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
      const created = await postsClient(jwtClient).create(
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
      const created = await postsClient(requestAwareClient).create(
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
        postsClient(publicClient).create({
          title: 'Client Posts: public create',
          status: 'draft',
        }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });

    it('throws for a non-existent post on update', async () => {
      await expect(
        postsClient(authClient).update(999999, { title: 'Ghost Post' }, postSchema),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });

    it('moves a post to trash when force is omitted', async () => {
      const created = await postsClient(authClient).create(
        {
          title: 'Client Posts: trash',
          status: 'draft',
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      const deleted = await postsClient(authClient).delete(created.id);

      expect(deleted.id).toBe(created.id);
      expect(deleted.deleted).toBe(false);
    });

    it('throws when attempting to delete a non-existent post', async () => {
      await expect(
        postsClient(authClient).delete(999999, { force: true })
      ).rejects.toThrow(/Invalid post ID/);
    });
  });
});
