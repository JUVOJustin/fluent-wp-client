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
  it('uses the runtime fetch with the global object context by default', async () => {
    const originalFetch = globalThis.fetch;
    let observedThis: unknown;

    globalThis.fetch = async function (
      this: typeof globalThis,
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      observedThis = this;
      return originalFetch.call(globalThis, input, init);
    };

    try {
      const client = new WordPressClient({ baseUrl: getBaseUrl() });
      const posts = await client.content('posts').list({ perPage: 1 });

      expect(posts).toHaveLength(1);
      expect(observedThis).toBe(globalThis);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('forwards custom headers for content(\'posts\') create/update/delete helpers', async () => {
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

    const posts = client.content('posts');

    const created = await posts.create(
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

    const updated = await posts.update(
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

    const deleted = await posts.delete(created.id, {
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

  it('forwards custom headers for read and listing helpers', async () => {
    const seen = {
      postsList: false,
      postByIdView: false,
      postByIdEdit: false,
      booksList: false,
      genreList: false,
    };

    const client = createObservedAuthClient((method, url, headers) => {
      if (method !== 'GET') {
        return;
      }

      if (url.pathname.endsWith('/wp-json/wp/v2/posts') && url.searchParams.has('per_page')) {
        seen.postsList = headers.get('x-test-source') === 'read-posts';
      }

      if (/\/wp-json\/wp\/v2\/posts\/\d+$/.test(url.pathname) && url.searchParams.get('context') !== 'edit') {
        seen.postByIdView = headers.get('x-test-source') === 'read-post-by-id';
      }

      if (/\/wp-json\/wp\/v2\/posts\/\d+$/.test(url.pathname) && url.searchParams.get('context') === 'edit') {
        seen.postByIdEdit = headers.get('x-test-source') === 'read-post-by-id';
      }

      if (url.pathname.endsWith('/wp-json/wp/v2/books') && url.searchParams.has('per_page')) {
        seen.booksList = headers.get('x-test-source') === 'read-books';
      }

      if (url.pathname.endsWith('/wp-json/wp/v2/genre') && url.searchParams.has('per_page')) {
        seen.genreList = headers.get('x-test-source') === 'read-genre';
      }

    });

    const posts = await client.content('posts').list(
      { perPage: 1 },
      {
        headers: {
          'x-test-source': 'read-posts',
        },
      },
    );

    const postQuery = client.content('posts').item(posts[0].id, {
      headers: {
        'x-test-source': 'read-post-by-id',
      },
    });

    await postQuery;
    await postQuery.getBlocks();

    const books = await client.content('books').list(
      { perPage: 1 },
      {
        headers: {
          'x-test-source': 'read-books',
        },
      },
    );

    const genres = await client.terms('genre').list(
      { perPage: 1 },
      {
        headers: {
          'x-test-source': 'read-genre',
        },
      },
    );

    expect(posts.length).toBeGreaterThan(0);
    expect(books.length).toBeGreaterThan(0);
    expect(Array.isArray(genres)).toBe(true);
    expect(seen.postsList).toBe(true);
    expect(seen.postByIdView).toBe(true);
    expect(seen.postByIdEdit).toBe(true);
    expect(seen.booksList).toBe(true);
    expect(seen.genreList).toBe(true);
  });

  it('rejects auth header overrides on read helpers', async () => {
    const client = createObservedAuthClient(() => undefined);

    await expect(
      client.content('posts').list(
        { perPage: 1 },
        {
          headers: {
            Authorization: 'Bearer blocked',
          },
        },
      ),
    ).rejects.toThrow(/auth header overrides are not supported/i);
  });

  it('ignores non-header override keys for mutation helpers even when passed as any', async () => {
    const seen = {
      usedPostsEndpoint: false,
      usedForcedQueryParam: false,
    };

    const client = createObservedAuthClient((method, url, headers) => {
      if (method !== 'POST') {
        return;
      }

      if (url.pathname.endsWith('/wp-json/wp/v2/posts')) {
        seen.usedPostsEndpoint = true;
        seen.usedForcedQueryParam = url.searchParams.get('forced') === '1';
        expect(headers.get('x-test-source')).toBe('ignore-non-header-mutation');
      }
    });

    const created = await client.content('posts').create(
      {
        title: 'Request overrides: ignore non-header keys',
        status: 'draft',
      },
      {
        headers: {
          'x-test-source': 'ignore-non-header-mutation',
        },
        endpoint: '/users',
        params: { forced: '1' },
        method: 'DELETE',
      } as unknown as never,
    );

    await client.content('posts').delete(created.id, { force: true });

    expect(created.id).toBeGreaterThan(0);
    expect(seen.usedPostsEndpoint).toBe(true);
    expect(seen.usedForcedQueryParam).toBe(false);
  });

  it('ignores non-header override keys for read helpers even when passed as any', async () => {
    const seen = {
      usedPostsEndpoint: false,
      usedInjectedSlugParam: false,
    };

    const client = createObservedAuthClient((method, url, headers) => {
      if (method !== 'GET') {
        return;
      }

      if (url.pathname.endsWith('/wp-json/wp/v2/posts') && url.searchParams.get('per_page') === '1') {
        seen.usedPostsEndpoint = true;
        seen.usedInjectedSlugParam = url.searchParams.get('slug') === 'test-post-999';
        expect(headers.get('x-test-source')).toBe('ignore-non-header-read');
      }
    });

    const posts = await client.content('posts').list(
      { perPage: 1 },
      {
        headers: {
          'x-test-source': 'ignore-non-header-read',
        },
        endpoint: '/users',
        params: { slug: 'test-post-999' },
      } as unknown as never,
    );

    expect(posts.length).toBe(1);
    expect(seen.usedPostsEndpoint).toBe(true);
    expect(seen.usedInjectedSlugParam).toBe(false);
  });
});
