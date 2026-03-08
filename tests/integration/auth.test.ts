import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createCookieAuthClient, getBaseUrl } from '../helpers/wp-client';

/**
 * Integration coverage for auth helpers and authenticated request transport.
 */
describe('Client: Auth', () => {
  let publicClient: WordPressClient;

  beforeAll(() => {
    publicClient = new WordPressClient({ baseUrl: getBaseUrl() });
  });

  it('creates and validates JWT tokens through dedicated helpers', async () => {
    const tokenResponse = await publicClient.loginWithJwt({
      username: 'admin',
      password: 'password',
    });

    expect(typeof tokenResponse.token).toBe('string');
    expect(tokenResponse.token.length).toBeGreaterThan(20);

    const validationResponse = await publicClient.validateJwtToken(tokenResponse.token);
    expect(validationResponse.code).toBe('jwt_auth_valid_token');
  });

  it('supports cookie nonce auth for authenticated REST endpoints', async () => {
    const cookieClient = createCookieAuthClient();
    const me = await cookieClient.getCurrentUser();

    expect(me.slug).toBe('admin');
  });

  it('forwards browser credentials and nonce headers for front-end requests', async () => {
    const restNonce = process.env.WP_REST_NONCE;
    const cookieHeader = process.env.WP_COOKIE_AUTH_HEADER;

    if (!restNonce || !cookieHeader) {
      throw new Error('Cookie auth env vars not set - did global-setup run?');
    }

    const browserClient = new WordPressClient({
      baseUrl: getBaseUrl(),
      auth: { nonce: restNonce, credentials: 'include' },
      fetch: async (input, init) => {
        const requestInit = init ?? {};

        expect(requestInit.credentials).toBe('include');

        const headers = new Headers(requestInit.headers ?? {});
        expect(headers.get('X-WP-Nonce')).toBe(restNonce);

        headers.set('Cookie', cookieHeader);

        return fetch(input, {
          ...requestInit,
          headers,
        });
      },
    });

    const me = await browserClient.getCurrentUser();
    expect(me.slug).toBe('admin');
  });
});
