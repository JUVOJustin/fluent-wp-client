import { describe, expect, it } from 'vitest';
import {
  WordPressApiError,
  WordPressClient,
  WordPressClientError,
  WordPressSchemaValidationError,
} from 'fluent-wp-client';
import { getBaseUrl } from '../helpers/wp-client';

/**
 * Integration coverage for the unified client error contract.
 */
describe('Client: Error Contract', () => {
  it('maps transport failures to NETWORK_ERROR with cause details', async () => {
    const client = new WordPressClient({
      baseUrl: getBaseUrl(),
      fetch: async () => {
        throw new TypeError('fetch failed from integration test');
      },
    });

    await expect(client.getPosts({ perPage: 1 })).rejects.toBeInstanceOf(WordPressClientError);

    try {
      await client.getPosts({ perPage: 1 });
      throw new Error('Expected getPosts to fail when fetch throws.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressClientError);
      const typed = error as WordPressClientError;
      expect(typed.kind).toBe('NETWORK_ERROR');
      expect(typed.operation).toBe('fetchAPI');
      expect(typed.method).toBe('GET');
      expect(typed.endpoint).toBe('/posts');
      expect(typed.cause).toBeInstanceOf(TypeError);
    }
  });

  it('maps invalid JSON responses to PARSE_ERROR', async () => {
    const client = new WordPressClient({
      baseUrl: getBaseUrl(),
      fetch: async () => new Response('not-json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });

    await expect(client.getPosts({ perPage: 1 })).rejects.toBeInstanceOf(WordPressClientError);

    try {
      await client.getPosts({ perPage: 1 });
      throw new Error('Expected getPosts to fail for invalid JSON payloads.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressClientError);
      const typed = error as WordPressClientError;
      expect(typed.kind).toBe('PARSE_ERROR');
      expect(typed.operation).toBe('fetchAPI');
      expect(typed.method).toBe('GET');
      expect(typed.endpoint).toBe('/posts');
      expect(typed.status).toBe(200);
      expect(typed.cause).toBeInstanceOf(SyntaxError);
    }
  });

  it('maps non-WordPress HTTP failures to HTTP_ERROR', async () => {
    const client = new WordPressClient({
      baseUrl: getBaseUrl(),
      fetch: async () => new Response('Service unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'text/plain',
        },
      }),
    });

    await expect(client.getPosts({ perPage: 1 })).rejects.toBeInstanceOf(WordPressClientError);

    try {
      await client.getPosts({ perPage: 1 });
      throw new Error('Expected getPosts to fail for HTTP 503.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressClientError);
      const typed = error as WordPressClientError;
      expect(typed.kind).toBe('HTTP_ERROR');
      expect(typed.operation).toBe('fetchAPI');
      expect(typed.method).toBe('GET');
      expect(typed.endpoint).toBe('/posts');
      expect(typed.status).toBe(503);
    }
  });

  it('maps auth preflight failures to AUTH_ERROR', async () => {
    const client = new WordPressClient({ baseUrl: getBaseUrl() });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(WordPressClientError);

    try {
      await client.getCurrentUser();
      throw new Error('Expected getCurrentUser to fail without auth.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressClientError);
      const typed = error as WordPressClientError;
      expect(typed.kind).toBe('AUTH_ERROR');
      expect(typed.operation).toBe('getCurrentUser');
      expect(typed.method).toBe('GET');
      expect(typed.endpoint).toBe('/users/me');
    }
  });

  it('maps WordPress API payload failures to WordPressApiError', async () => {
    const client = new WordPressClient({ baseUrl: getBaseUrl() });

    await expect(client.loginWithJwt({ username: 'admin', password: 'wrong-password' })).rejects.toBeInstanceOf(WordPressApiError);

    try {
      await client.loginWithJwt({ username: 'admin', password: 'wrong-password' });
      throw new Error('Expected loginWithJwt to fail with invalid credentials.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressApiError);
      const typed = error as WordPressApiError;
      expect(typed.kind).toBe('WP_API_ERROR');
      expect(typed.operation).toBe('loginWithJwt');
      expect(typed.method).toBe('POST');
      expect(typed.endpoint).toBe('/wp-json/jwt-auth/v1/token');
      expect(typeof typed.message).toBe('string');
      expect(typed.message.length).toBeGreaterThan(0);
      expect(typeof typed.code === 'string' || typed.code === null).toBe(true);
    }
  });

  it('maps schema mismatches to SCHEMA_VALIDATION_ERROR', async () => {
    const client = new WordPressClient({ baseUrl: getBaseUrl() });

    const strictSchema = {
      '~standard': {
        validate: () => ({
          issues: [{ message: 'forced schema mismatch', path: [] }],
        }),
      },
    };

    await expect(
      client.loginWithJwt({ username: 'admin', password: 'password' }, strictSchema as any),
    ).rejects.toBeInstanceOf(WordPressSchemaValidationError);

    try {
      await client.loginWithJwt({ username: 'admin', password: 'password' }, strictSchema as any);
      throw new Error('Expected loginWithJwt to fail for strict response schema.');
    } catch (error) {
      expect(error).toBeInstanceOf(WordPressSchemaValidationError);
      const typed = error as WordPressSchemaValidationError;
      expect(typed.kind).toBe('SCHEMA_VALIDATION_ERROR');
      expect(typed.operation).toBe('loginWithJwt');
      expect(typed.method).toBe('POST');
      expect(typed.endpoint).toBe('/wp-json/jwt-auth/v1/token');
      expect(Array.isArray(typed.issues)).toBe(true);
      expect(typed.issues.length).toBeGreaterThan(0);
    }
  });

  it('keeps low-level request raw for non-2xx responses', async () => {
    const client = new WordPressClient({
      baseUrl: getBaseUrl(),
      fetch: async () => new Response('Gateway outage', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: {
          'Content-Type': 'text/plain',
        },
      }),
    });

    const result = await client.request<string>({
      endpoint: '/posts',
      method: 'GET',
    });

    expect(result.response.status).toBe(502);
    expect(result.data).toBe('Gateway outage');
  });
});
