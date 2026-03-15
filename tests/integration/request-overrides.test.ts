import { describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { getBaseUrl } from '../helpers/wp-client';

/**
 * Creates one authenticated client that inspects outgoing requests in-flight.
 */
function createObservedAuthClient(
  observer: (method: string, url: URL, headers: Headers) => void,
): WordPressClient {
  const password = process.env.WP_APP_PASSWORD;

  if (!password) {
    throw new Error('WP_APP_PASSWORD not set — did global-setup run?');
  }

  return new WordPressClient({
    baseUrl: getBaseUrl(),
    auth: { username: 'admin', password },
    fetch: async (input, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const requestUrl = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
      );
      const headers = new Headers(init.headers ?? {});

      observer(method, requestUrl, headers);

      return fetch(input, init);
    },
  });
}

/**
 * Integration coverage for request-scoped overrides on high-level mutation helpers.
 */
describe('Client: request-scoped mutation overrides', () => {
  it('rejects auth header overrides on mutation helper options', async () => {
    const client = createObservedAuthClient(() => undefined);

    await expect(
      client.createPost(
        {
          title: 'Request overrides: auth header should fail',
          status: 'draft',
        },
        {
          headers: {
            Authorization: 'Bearer should-not-be-allowed',
          },
        },
      ),
    ).rejects.toThrow(/auth header overrides are not supported/i);
  });

  it('rejects auth-like header overrides on WPAPI chains', () => {
    const client = createObservedAuthClient(() => undefined);

    expect(() => client.posts().setHeaders('Authorization', 'Bearer blocked')).toThrow(
      /auth header overrides are not supported/i,
    );
  });

  it('forwards custom headers for post create/update/delete helpers', async () => {
    const seen = {
      create: false,
      update: false,
      delete: false,
    };

    const client = createObservedAuthClient((method, url, headers) => {
      if (method === 'POST' && url.pathname.endsWith('/wp-json/wp/v2/posts')) {
        seen.create = headers.get('x-test-source') === 'post-create';
      }

      if (method === 'POST' && /\/wp-json\/wp\/v2\/posts\/\d+$/.test(url.pathname)) {
        seen.update = headers.get('x-test-source') === 'post-update';
      }

      if (method === 'DELETE' && /\/wp-json\/wp\/v2\/posts\/\d+$/.test(url.pathname)) {
        seen.delete = headers.get('x-test-source') === 'post-delete';
      }
    });

    const created = await client.createPost(
      {
        title: 'Request overrides: post create',
        status: 'draft',
      },
      {
        headers: {
          'x-test-source': 'post-create',
        },
      },
    );

    const updated = await client.updatePost(
      created.id,
      {
        title: 'Request overrides: post update',
        status: 'private',
      },
      {
        headers: {
          'x-test-source': 'post-update',
        },
      },
    );

    const deleted = await client.deletePost(created.id, {
      force: true,
      headers: {
        'x-test-source': 'post-delete',
      },
    });

    expect(updated.status).toBe('private');
    expect(deleted.deleted).toBe(true);
    expect(seen.create).toBe(true);
    expect(seen.update).toBe(true);
    expect(seen.delete).toBe(true);
  });

  it('forwards custom headers for uploadMedia including metadata update', async () => {
    const seen = {
      upload: false,
      metadataUpdate: false,
    };

    const client = createObservedAuthClient((method, url, headers) => {
      if (method !== 'POST') {
        return;
      }

      if (url.pathname.endsWith('/wp-json/wp/v2/media')) {
        seen.upload = headers.get('x-test-source') === 'media-upload';
      }

      if (/\/wp-json\/wp\/v2\/media\/\d+$/.test(url.pathname)) {
        seen.metadataUpdate = headers.get('x-test-source') === 'media-upload';
      }
    });

    const png1x1 = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00,
      0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63,
      0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d,
      0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const media = await client.uploadMedia(
      {
        file: png1x1,
        filename: 'request-overrides-1x1.png',
        mimeType: 'image/png',
        title: 'Request overrides media title',
      },
      {
        headers: {
          'x-test-source': 'media-upload',
        },
      },
    );

    await client.deleteMedia(media.id, { force: true });

    expect(seen.upload).toBe(true);
    expect(seen.metadataUpdate).toBe(true);
  });

  it('forwards custom headers for generic content() and terms() mutations', async () => {
    const seen = {
      contentCreate: false,
      contentUpdate: false,
      contentDelete: false,
      termCreate: false,
      termUpdate: false,
      termDelete: false,
    };

    const client = createObservedAuthClient((method, url, headers) => {
      if (method === 'POST' && url.pathname.endsWith('/wp-json/wp/v2/books')) {
        seen.contentCreate = headers.get('x-test-source') === 'books-create';
      }

      if (method === 'POST' && /\/wp-json\/wp\/v2\/books\/\d+$/.test(url.pathname)) {
        seen.contentUpdate = headers.get('x-test-source') === 'books-update';
      }

      if (method === 'DELETE' && /\/wp-json\/wp\/v2\/books\/\d+$/.test(url.pathname)) {
        seen.contentDelete = headers.get('x-test-source') === 'books-delete';
      }

      if (method === 'POST' && url.pathname.endsWith('/wp-json/wp/v2/genre')) {
        seen.termCreate = headers.get('x-test-source') === 'genre-create';
      }

      if (method === 'POST' && /\/wp-json\/wp\/v2\/genre\/\d+$/.test(url.pathname)) {
        seen.termUpdate = headers.get('x-test-source') === 'genre-update';
      }

      if (method === 'DELETE' && /\/wp-json\/wp\/v2\/genre\/\d+$/.test(url.pathname)) {
        seen.termDelete = headers.get('x-test-source') === 'genre-delete';
      }
    });

    const books = client.content('books');
    const genres = client.terms('genre');

    const createdBook = await books.create(
      {
        title: 'Request overrides: books create',
        status: 'draft',
      },
      {
        headers: {
          'x-test-source': 'books-create',
        },
      },
    );

    await books.update(
      createdBook.id,
      {
        title: 'Request overrides: books update',
        status: 'private',
      },
      {
        headers: {
          'x-test-source': 'books-update',
        },
      },
    );

    await books.delete(createdBook.id, {
      force: true,
      headers: {
        'x-test-source': 'books-delete',
      },
    });

    const createdGenre = await genres.create(
      {
        name: 'request-overrides-genre-create',
      },
      {
        headers: {
          'x-test-source': 'genre-create',
        },
      },
    );

    await genres.update(
      createdGenre.id,
      {
        name: 'request-overrides-genre-update',
      },
      {
        headers: {
          'x-test-source': 'genre-update',
        },
      },
    );

    await genres.delete(createdGenre.id, {
      force: true,
      headers: {
        'x-test-source': 'genre-delete',
      },
    });

    expect(seen.contentCreate).toBe(true);
    expect(seen.contentUpdate).toBe(true);
    expect(seen.contentDelete).toBe(true);
    expect(seen.termCreate).toBe(true);
    expect(seen.termUpdate).toBe(true);
    expect(seen.termDelete).toBe(true);
  });
});
