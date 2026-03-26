import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for content field enforcement in getContent() and getBlocks().
 *
 * When calling getContent() or getBlocks(), the content field must be available.
 * These tests verify that the client enforces content field fetching even when
 * the fields filter explicitly excludes it.
 */
describe('Client: Content field enforcement', () => {
  let authClient: WordPressClient;
  let publicClient: WordPressClient;
  const createdPostIds: number[] = [];

  beforeAll(() => {
    authClient = createAuthClient();
    publicClient = createPublicClient();
  });

  afterAll(async () => {
    for (const id of createdPostIds) {
      await authClient.content('posts').delete(id, { force: true }).catch(() => undefined);
    }
  });

  describe('getContent() field enforcement', () => {
    it('enforces content field when fields filter excludes it', async () => {
      const slug = `client-content-enforce-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'Content enforcement test',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Test content body.</p><!-- /wp:paragraph -->',
      });

      createdPostIds.push(created.id);

      // Request with fields filter that explicitly excludes 'content'
      const content = await authClient
        .content('posts')
        .item(slug, { fields: ['id', 'slug', 'title'] })
        .getContent();

      expect(content).toBeDefined();
      expect(content?.raw).toContain('<!-- wp:paragraph -->');
      expect(content?.rendered).toContain('<p>Test content body.</p>');
    });

    it('returns content when fields filter includes content', async () => {
      const slug = `client-content-include-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'Content included test',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Included content.</p><!-- /wp:paragraph -->',
      });

      createdPostIds.push(created.id);

      // Request with fields filter that includes 'content'
      const content = await authClient
        .content('posts')
        .item(slug, { fields: ['id', 'slug', 'title', 'content'] })
        .getContent();

      expect(content).toBeDefined();
      expect(content?.raw).toContain('<!-- wp:paragraph -->');
    });

    it('enforces content field by ID when fields filter excludes it', async () => {
      const slug = `client-content-enforce-id-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'Content enforcement by ID',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Content by ID.</p><!-- /wp:paragraph -->',
      });

      createdPostIds.push(created.id);

      // Request by ID with fields filter that excludes content
      const content = await authClient
        .content('posts')
        .item(created.id, { fields: ['id', 'slug'] })
        .getContent();

      expect(content).toBeDefined();
      expect(content?.raw).toContain('<!-- wp:paragraph -->');
    });
  });

  describe('getBlocks() field enforcement', () => {
    it('enforces content field when fields filter excludes it', async () => {
      const slug = `client-blocks-enforce-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'Blocks enforcement test',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Blocks test body.</p><!-- /wp:paragraph -->',
      });

      createdPostIds.push(created.id);

      // Request with fields filter that excludes 'content'
      const blocks = await authClient
        .content('posts')
        .item(slug, { fields: ['id', 'slug', 'title'] })
        .getBlocks();

      expect(blocks).toBeDefined();
      expect(blocks).toHaveLength(1);
      expect(blocks?.[0].blockName).toBe('core/paragraph');
    });

    it('returns blocks when fields filter includes content', async () => {
      const slug = `client-blocks-include-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'Blocks included test',
        slug,
        status: 'publish',
        content: '<!-- wp:heading --><h2>Heading block</h2><!-- /wp:heading -->',
      });

      createdPostIds.push(created.id);

      // Request with fields filter that includes 'content'
      const blocks = await authClient
        .content('posts')
        .item(slug, { fields: ['id', 'content'] })
        .getBlocks();

      expect(blocks).toBeDefined();
      expect(blocks?.[0].blockName).toBe('core/heading');
    });
  });

  describe('explicit content field exclusion behavior', () => {
    it('item() with fields filter can limit returned fields in view context', async () => {
      const slug = `client-view-fields-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'View with fields filter',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Content in view.</p><!-- /wp:paragraph -->',
      });

      createdPostIds.push(created.id);

      // In view context with fields filter, only requested fields are returned
      const post = await authClient
        .content('posts')
        .item(slug, { fields: ['id', 'slug', 'title'] });

      expect(post).toBeDefined();
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('title');
      // Fields not requested may or may not be present depending on WordPress behavior
    });

    it('getContent() fetches content even when fields filter excludes it', async () => {
      const slug = `client-content-fetches-${Date.now()}`;
      const created = await authClient.content('posts').create({
        title: 'Content fetches separately',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Content fetched separately.</p><!-- /wp:paragraph -->',
      });

      createdPostIds.push(created.id);

      // getContent() should always work because it explicitly requests content in edit context
      const content = await authClient
        .content('posts')
        .item(slug, { fields: ['id', 'slug', 'title'] })
        .getContent();

      expect(content).toBeDefined();
      expect(content?.raw).toContain('<!-- wp:paragraph -->');
    });
  });

  describe('fallback behavior when content is unavailable', () => {
    it('returns undefined for getContent() when post not found', async () => {
      const content = await authClient
        .content('posts')
        .item('non-existent-post-12345')
        .getContent();

      expect(content).toBeUndefined();
    });

    it('returns undefined for getBlocks() when post not found', async () => {
      const blocks = await authClient
        .content('posts')
        .item('non-existent-post-12345')
        .getBlocks();

      expect(blocks).toBeUndefined();
    });

    it('throws appropriate error when public client calls getContent()', async () => {
      await expect(
        publicClient.content('posts').item('test-post-001').getContent(),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });
  });

  describe('content field enforcement for pages', () => {
    const createdPageIds: number[] = [];

    afterAll(async () => {
      for (const id of createdPageIds) {
        await authClient.content('pages').delete(id, { force: true }).catch(() => undefined);
      }
    });

    it('enforces content field for pages when fields filter excludes it', async () => {
      const slug = `client-page-content-enforce-${Date.now()}`;
      const created = await authClient.content('pages').create({
        title: 'Page content enforcement',
        slug,
        status: 'publish',
        content: '<!-- wp:paragraph --><p>Page content body.</p><!-- /wp:paragraph -->',
      });

      createdPageIds.push(created.id);

      // Request with fields filter that excludes 'content'
      const content = await authClient
        .content('pages')
        .item(slug, { fields: ['id', 'slug', 'title'] })
        .getContent();

      expect(content).toBeDefined();
      expect(content?.raw).toContain('<!-- wp:paragraph -->');
    });

    it('enforces content field for page getBlocks()', async () => {
      const slug = `client-page-blocks-enforce-${Date.now()}`;
      const created = await authClient.content('pages').create({
        title: 'Page blocks enforcement',
        slug,
        status: 'publish',
        content: '<!-- wp:heading --><h2>Page heading</h2><!-- /wp:heading -->',
      });

      createdPageIds.push(created.id);

      // Request with fields filter that excludes 'content'
      const blocks = await authClient
        .content('pages')
        .item(slug, { fields: ['id', 'slug'] })
        .getBlocks();

      expect(blocks).toBeDefined();
      expect(blocks?.[0].blockName).toBe('core/heading');
    });
  });
});
