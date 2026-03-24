import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient, getBaseUrl } from '../helpers/wp-client';

/**
 * Integration coverage for Gutenberg block parsing helpers.
 *
 * Single-item `content(resource).item(...)` queries are awaitable and expose
 * `.getBlocks()` and `.getContent()`.
 *
 * List methods return plain serializable DTOs without block helpers. Use a
 * single-item query on a known ID for block access.
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

  function postsClient(client: WordPressClient) {
    return client.content('posts');
  }

  function pagesClient(client: WordPressClient) {
    return client.content('pages');
  }

  afterAll(async () => {
    for (const id of createdPostIds) {
      await postsClient(authClient).delete(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdPageIds) {
      await pagesClient(authClient).delete(id, { force: true }).catch(() => undefined);
    }
  });

  it('parses post blocks from one slug query chain', async () => {
    const slug = `client-blocks-post-${Date.now()}`;
    const created = await postsClient(authClient).create({
      title: 'Client Blocks: post',
      slug,
      status: 'publish',
      content: '<!-- wp:paragraph {"dropCap":false} --><p>Post block body.</p><!-- /wp:paragraph -->',
    });

    createdPostIds.push(created.id);

    const blocks = await postsClient(authClient).item(slug).getBlocks();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].blockName).toBe('core/paragraph');
    expect(typeof blocks?.[0].attrs).toBe('object');
    expect(blocks?.[0].innerHTML).toContain('<p>Post block body.</p>');
  });

  it('parses page blocks from one slug query chain', async () => {
    const slug = `client-blocks-page-${Date.now()}`;
    const created = await pagesClient(authClient).create({
      title: 'Client Blocks: page',
      slug,
      status: 'publish',
      content: '<!-- wp:heading {"level":3} --><h3>Page block heading.</h3><!-- /wp:heading -->',
    });

    createdPageIds.push(created.id);

    const blocks = await pagesClient(authClient).item(slug).getBlocks();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].blockName).toBe('core/heading');
    expect(blocks?.[0].attrs).toMatchObject({ level: 3 });
    expect(blocks?.[0].innerHTML).toContain('<h3>Page block heading.</h3>');
  });

  it('returns raw and rendered content from getContent()', async () => {
    const slug = `client-blocks-content-${Date.now()}`;
    const created = await postsClient(authClient).create({
      title: 'Client Blocks: content payload',
      slug,
      status: 'publish',
      content: '<!-- wp:paragraph --><p>Content payload body.</p><!-- /wp:paragraph -->',
    });

    createdPostIds.push(created.id);

    const content = await postsClient(authClient).item(slug).getContent();

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

    await countingClient.content('posts').item('test-post-001').getBlocks().catch(() => undefined);

    expect(requestCount).toBe(1);
  });

  it('throws auth/capability error when public client calls getBlocks()', async () => {
    await expect(
      publicClient.content('posts').item('test-post-001').getBlocks(),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
    });
  });

  it('retrieves blocks from list items via single-item query', async () => {
    const slug = `client-blocks-list-query-${Date.now()}`;
    const created = await postsClient(authClient).create({
      title: 'Client Blocks: list to query',
      slug,
      status: 'publish',
      content: '<!-- wp:paragraph --><p>List-to-query block body.</p><!-- /wp:paragraph -->',
    });

    createdPostIds.push(created.id);

    const posts = await postsClient(authClient).list({ perPage: 100, page: 1 });
    const match = posts.find((post) => post.id === created.id);

    expect(match).toBeDefined();

    const blocks = await postsClient(authClient).item(match!.id).getBlocks();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].blockName).toBe('core/paragraph');
    expect(blocks![0].innerHTML).toContain('<p>List-to-query block body.</p>');
  });

  it('retrieves blocks from page list items via single-item query', async () => {
    const slug = `client-blocks-list-page-${Date.now()}`;
    const created = await pagesClient(authClient).create({
      title: 'Client Blocks: page list to query',
      slug,
      status: 'publish',
      content: '<!-- wp:paragraph --><p>Page list block body.</p><!-- /wp:paragraph -->',
    });

    createdPageIds.push(created.id);

    const pages = await pagesClient(authClient).list({ perPage: 100, page: 1 });
    const match = pages.find((page) => page.id === created.id);

    expect(match).toBeDefined();

    const blocks = await pagesClient(authClient).item(match!.id).getBlocks();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].innerHTML).toContain('<p>Page list block body.</p>');
  });
});
