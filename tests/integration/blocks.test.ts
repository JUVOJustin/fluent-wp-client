import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient, getBaseUrl } from '../helpers/wp-client';

/**
 * Integration coverage for Gutenberg block parsing helpers.
 */
describe('Client: Gutenberg block parsing', () => {
  let authClient: WordPressClient;
  let publicClient: WordPressClient;
  const createdPostIds: number[] = [];
  const createdPageIds: number[] = [];

  beforeAll(() => {
    authClient = createAuthClient();
    publicClient = createPublicClient();
  });

  afterAll(async () => {
    for (const id of createdPostIds) {
      await authClient.deletePost(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdPageIds) {
      await authClient.deletePage(id, { force: true }).catch(() => undefined);
    }
  });

  it('parses post blocks from one slug query chain', async () => {
    const slug = `client-blocks-post-${Date.now()}`;
    const created = await authClient.createPost({
      title: 'Client Blocks: post',
      slug,
      status: 'publish',
      content: '<!-- wp:paragraph {"dropCap":false} --><p>Post block body.</p><!-- /wp:paragraph -->',
    });

    createdPostIds.push(created.id);

    const blocks = await authClient.getPostBySlug(slug).getBlocks();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].blockName).toBe('core/paragraph');
    expect(typeof blocks?.[0].attrs).toBe('object');
    expect(blocks?.[0].innerHTML).toContain('<p>Post block body.</p>');
  });

  it('parses page blocks from one slug query chain', async () => {
    const slug = `client-blocks-page-${Date.now()}`;
    const created = await authClient.createPage({
      title: 'Client Blocks: page',
      slug,
      status: 'publish',
      content: '<!-- wp:heading {"level":3} --><h3>Page block heading.</h3><!-- /wp:heading -->',
    });

    createdPageIds.push(created.id);

    const blocks = await authClient.getPageBySlug(slug).getBlocks();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].blockName).toBe('core/heading');
    expect(blocks?.[0].attrs).toMatchObject({ level: 3 });
    expect(blocks?.[0].innerHTML).toContain('<h3>Page block heading.</h3>');
  });

  it('returns raw and rendered content from getContent()', async () => {
    const slug = `client-blocks-content-${Date.now()}`;
    const created = await authClient.createPost({
      title: 'Client Blocks: content payload',
      slug,
      status: 'publish',
      content: '<!-- wp:paragraph --><p>Content payload body.</p><!-- /wp:paragraph -->',
    });

    createdPostIds.push(created.id);

    const content = await authClient.getPostBySlug(slug).getContent();

    expect(content).toBeDefined();
    expect(content?.raw).toContain('<!-- wp:paragraph -->');
    expect(content?.rendered).toContain('<p>Content payload body.</p>');
  });

  it('uses one HTTP request when getBlocks() is called directly', async () => {
    const password = process.env.WP_APP_PASSWORD;

    if (!password) {
      throw new Error('WP_APP_PASSWORD not set - did global-setup run?');
    }

    let requestCount = 0;
    const countingClient = new WordPressClient({
      baseUrl: getBaseUrl(),
      auth: { username: 'admin', password },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        requestCount += 1;
        return fetch(input, init);
      },
    });

    await countingClient.getPostBySlug('test-post-001').getBlocks().catch(() => undefined);

    expect(requestCount).toBe(1);
  });

  it('throws auth/capability error when public client calls getBlocks()', async () => {
    await expect(
      publicClient.getPostBySlug('test-post-001').getBlocks(),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
    });
  });

  it('supports getBlocks() from getPosts() list results', async () => {
    const posts = await authClient.getPosts({ perPage: 1, page: 1 });

    expect(posts.length).toBeGreaterThan(0);

    const firstPost = posts[0] as unknown as { getBlocks: () => Promise<unknown[]> };
    const blocks = await firstPost.getBlocks();

    expect(Array.isArray(blocks)).toBe(true);
    expect((blocks as unknown[]).length).toBeGreaterThan(0);
  });

  it('supports getBlocks() from getPages() list results', async () => {
    const pages = await authClient.getPages({ perPage: 1, page: 1 });

    expect(pages.length).toBeGreaterThan(0);

    const firstPage = pages[0] as unknown as { getBlocks: () => Promise<unknown[]> };
    const blocks = await firstPage.getBlocks();

    expect(Array.isArray(blocks)).toBe(true);
    expect((blocks as unknown[]).length).toBeGreaterThan(0);
  });
});
