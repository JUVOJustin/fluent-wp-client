import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient, postSchema } from 'fluent-wp-client';
import {
  createAuthClient,
  createCookieAuthClient,
  createJwtAuthClient,
  getBaseUrl,
} from '../helpers/wp-client';

/**
 * Integration coverage for full CRUD operations across every supported auth method.
 *
 * The primary scenario: a plugin ships this library on the WordPress frontend
 * (same domain). The user is already authenticated via a browser session cookie.
 * Requests must carry the cookie and X-WP-Nonce header so WP recognises the
 * session and authorises writes — without a separate Authorization header.
 *
 * This suite verifies that create, read, update, and delete all succeed for:
 * 1. Cookie + nonce auth (server-side cookie header)
 * 2. Cookie + nonce auth (browser-style custom fetch that injects cookies)
 * 3. Basic / app-password auth (baseline comparison)
 * 4. JWT bearer auth (baseline comparison)
 */
describe('Client: Auth CRUD', () => {
  let basicClient: WordPressClient;
  let jwtClient: WordPressClient;
  let cookieClient: WordPressClient;

  /** Tracks post IDs created during tests so afterAll can clean up. */
  const createdPostIds: number[] = [];

  beforeAll(() => {
    basicClient = createAuthClient();
    jwtClient = createJwtAuthClient();
    cookieClient = createCookieAuthClient();
  });

  afterAll(async () => {
    for (const id of createdPostIds) {
      await basicClient.content('posts').delete(id, { force: true }).catch(() => undefined);
    }
  });

  /**
   * Exercises a full post lifecycle against the given client.
   * Returns the created post ID so the caller can track it for cleanup.
   */
  async function runCrudLifecycle(client: WordPressClient, label: string): Promise<number> {
    const created = await client.content('posts').create(
      {
        title: `Auth CRUD: ${label} create`,
        content: `<p>Created with ${label} auth.</p>`,
        status: 'draft',
      },
      postSchema,
    );

    createdPostIds.push(created.id);

    expect(created.id).toBeGreaterThan(0);
    expect(created.title.rendered).toBe(`Auth CRUD: ${label} create`);
    expect(created.content.rendered).toContain(`Created with ${label} auth.`);
    expect(created.status).toBe('draft');

    const updated = await client.content('posts').update(
      created.id,
      {
        title: `Auth CRUD: ${label} update`,
        status: 'private',
      },
      postSchema,
    );

    expect(updated.title.rendered).toBe(`Auth CRUD: ${label} update`);
    expect(updated.status).toBe('private');

    const deleted = await client.content('posts').delete(created.id, { force: true });

    expect(deleted.deleted).toBe(true);

    return created.id;
  }

  describe('cookie + nonce auth (same-domain frontend)', () => {
    it('identifies the authenticated user', async () => {
      const me = await cookieClient.getCurrentUser();

      expect(me.slug).toBe('admin');
    });

    it('creates, updates, and deletes a post', async () => {
      await runCrudLifecycle(cookieClient, 'cookie');
    });

    it('creates a post with rich content and category assignment', async () => {
      const created = await cookieClient.content('posts').create(
        {
          title: 'Auth CRUD: cookie rich content',
          content: '<p>Paragraph from cookie auth.</p>',
          excerpt: 'Cookie auth excerpt',
          status: 'draft',
          categories: [1],
        },
        postSchema,
      );

      createdPostIds.push(created.id);

      expect(created.content.rendered).toContain('Paragraph from cookie auth.');
      expect(created.excerpt.rendered).toContain('Cookie auth excerpt');
      expect(created.categories).toContain(1);
    });
  });

  describe('cookie + nonce auth (browser-style custom fetch)', () => {
    let browserClient: WordPressClient;

    beforeAll(() => {
      const restNonce = process.env.WP_REST_NONCE;
      const cookieHeader = process.env.WP_COOKIE_AUTH_HEADER;

      if (!restNonce || !cookieHeader) {
        throw new Error('Cookie auth env vars not set — did global-setup run?');
      }

      /**
       * Simulates a real browser environment where fetch sends cookies
       * automatically and the library only needs to set X-WP-Nonce.
       * The custom fetch intercepts every request, asserts that the
       * nonce header and credentials mode are correct, then injects
       * the session cookie before forwarding the request.
       */
      browserClient = new WordPressClient({
        baseUrl: getBaseUrl(),
        auth: { nonce: restNonce, credentials: 'include' },
        fetch: async (input, init) => {
          const requestInit = init ?? {};
          const headers = new Headers(requestInit.headers ?? {});

          expect(requestInit.credentials).toBe('include');
          expect(headers.get('X-WP-Nonce')).toBe(restNonce);
          expect(headers.get('Authorization')).toBeNull();

          headers.set('Cookie', cookieHeader);

          return fetch(input, { ...requestInit, headers });
        },
      });
    });

    it('identifies the authenticated user', async () => {
      const me = await browserClient.getCurrentUser();

      expect(me.slug).toBe('admin');
    });

    it('creates, updates, and deletes a post', async () => {
      await runCrudLifecycle(browserClient, 'browser-cookie');
    });
  });

  describe('basic / app-password auth (baseline)', () => {
    it('creates, updates, and deletes a post', async () => {
      await runCrudLifecycle(basicClient, 'basic');
    });
  });

  describe('JWT bearer auth (baseline)', () => {
    it('creates, updates, and deletes a post', async () => {
      await runCrudLifecycle(jwtClient, 'jwt');
    });
  });
});
