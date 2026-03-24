import { beforeAll, describe, expect, it } from 'vitest';
import {
  WordPressApiError,
  WordPressClient,
  WordPressSchemaValidationError,
  jwtAuthErrorResponseSchema,
  jwtAuthTokenResponseSchema,
  jwtAuthValidationResponseSchema,
} from 'fluent-wp-client';
import { createCookieAuthClient, createAuthClient, getBaseUrl } from '../helpers/wp-client';

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
    const tokenValidationResult = await jwtAuthTokenResponseSchema['~standard'].validate(tokenResponse);

    if (tokenValidationResult.issues) {
      throw new Error('JWT token response schema validation failed');
    }

    const parsedTokenResponse = tokenValidationResult.value;

    expect(typeof parsedTokenResponse.token).toBe('string');
    expect(parsedTokenResponse.token.length).toBeGreaterThan(20);

    const validationResponse = await publicClient.validateJwtToken(tokenResponse.token);
    const jwtValidationResult = await jwtAuthValidationResponseSchema['~standard'].validate(validationResponse);

    if (jwtValidationResult.issues) {
      throw new Error('JWT validation response schema validation failed');
    }

    const parsedValidationResponse = jwtValidationResult.value;

    expect(parsedValidationResponse.code).toBe('jwt_auth_valid_token');
  });

  it('exports one runtime schema for JWT plugin error responses', async () => {
    try {
      await publicClient.loginWithJwt({
        username: 'admin',
        password: 'not-the-right-password',
      });
      throw new Error('Expected JWT login to fail with invalid credentials.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressApiError);

      const errorValidationResult = await jwtAuthErrorResponseSchema['~standard'].validate(
        (error as WordPressApiError).responseBody,
      );

      if (errorValidationResult.issues) {
        throw new Error('JWT error response schema validation failed');
      }

      const parsedErrorResponse = errorValidationResult.value;

      expect(parsedErrorResponse.message.length).toBeGreaterThan(0);
    }
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

  it('supports browser-style public reads without auth headers', async () => {
    const browserPublicClient = new WordPressClient({
      baseUrl: getBaseUrl(),
      fetch: async (input, init) => {
        const requestInit = init ?? {};
        const headers = new Headers(requestInit.headers ?? {});

        expect(requestInit.credentials).toBeUndefined();
        expect(headers.get('Authorization')).toBeNull();
        expect(headers.get('X-WP-Nonce')).toBeNull();

        return fetch(input, requestInit);
      },
    });

    const posts = await browserPublicClient.content('posts').list({ perPage: 5 });

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it('loginWithJwt returns JWT token response', async () => {
    const result = await publicClient.loginWithJwt({
      username: 'admin',
      password: 'password',
    });

    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(20);
    expect(result.user_email).toBe('wordpress@example.com');
  });

  it('validateJwtToken validates a token successfully', async () => {
    const tokenResponse = await publicClient.loginWithJwt({
      username: 'admin',
      password: 'password',
    });

    const result = await publicClient.validateJwtToken(tokenResponse.token);

    expect(result.code).toBe('jwt_auth_valid_token');
    expect(result.data).toBeDefined();
  });

  it('updateSettings accepts custom responseSchema override and returns narrowed type', async () => {
    const authClient = createAuthClient();

    const minimalSettingsSchema = {
      '~standard': {
        validate: (value: unknown) => {
          const obj = value as Record<string, unknown>;
          if (typeof obj?.title !== 'string') {
            return { issues: [{ message: 'title must be a string', path: ['title'] }] };
          }
          return { value: { title: obj.title } };
        },
      },
    };

    const result = await authClient.updateSettings(
      { title: 'Test Site Title Override' },
      minimalSettingsSchema as any,
    );

    expect(typeof result.title).toBe('string');
    expect((result as any).description).toBeUndefined();
  });
});
