import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient, contentWordPressSchema, createBasicAuthHeader } from 'fluent-wp-client';
import { createAuthClient, createPublicClient, getBaseUrl } from '../helpers/wp-client';

type ResourceName = 'posts' | 'pages' | 'books';

interface ResourceHarness {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  update: (id: number, input: Record<string, unknown>) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
}

/**
 * Builds one basic auth header for direct REST readback checks.
 */
function getAuthHeader(): string {
  const password = process.env.WP_APP_PASSWORD;

  if (!password) {
    throw new Error('WP_APP_PASSWORD not set - did global-setup run?');
  }

  return createBasicAuthHeader({
    username: 'admin',
    password,
  });
}

/**
 * Extracts the numeric id from one generic REST response object.
 */
function getEntryId(entry: unknown): number {
  return (entry as { id: number }).id;
}

/**
 * Normalizes the REST meta payload to a plain object for assertions.
 */
function getMetaRecord(entry: unknown): Record<string, unknown> {
  const meta = (entry as { meta?: Record<string, unknown> | unknown[] }).meta;

  if (!meta || Array.isArray(meta)) {
    return {};
  }

  return meta;
}

/**
 * Creates one resource-specific CRUD harness backed by the standalone client.
 */
function createResourceHarness(client: WordPressClient, resource: ResourceName): ResourceHarness {
  if (resource === 'posts') {
    return {
      create: (input) => client.createPost(input),
      update: (id, input) => client.updatePost(id, input),
      remove: (id) => client.deletePost(id, { force: true }),
    };
  }

  if (resource === 'pages') {
    return {
      create: (input) => client.createPage(input),
      update: (id, input) => client.updatePage(id, input),
      remove: (id) => client.deletePage(id, { force: true }),
    };
  }

  const books = client.content('books', contentWordPressSchema);

  return {
    create: (input) => books.create(input),
    update: (id, input) => books.update(id, input),
    remove: (id) => books.delete(id, { force: true }),
  };
}

/**
 * Reads one resource directly from the REST API to verify persisted fields.
 */
async function fetchResource(resource: ResourceName, id: number): Promise<Record<string, unknown>> {
  const response = await fetch(`${getBaseUrl()}/wp-json/wp/v2/${resource}/${id}`, {
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(`Expected ${resource}/${id} to exist. Received ${response.status}.`);
  }

  return await response.json() as Record<string, unknown>;
}

/**
 * Tracks created entries per resource so the suite can clean up after itself.
 */
const createdIds: Record<ResourceName, number[]> = {
  posts: [],
  pages: [],
  books: [],
};

/**
 * Integration coverage for registered REST meta fields through the standalone client.
 */
describe('Client: meta fields', () => {
  let client: WordPressClient;

  beforeAll(() => {
    client = createAuthClient();
  });

  afterAll(async () => {
    for (const resource of Object.keys(createdIds) as ResourceName[]) {
      const harness = createResourceHarness(client, resource);

      for (const id of createdIds[resource]) {
        await harness.remove(id).catch(() => undefined);
      }
    }
  });

  describe.each([{ resource: 'posts' }, { resource: 'pages' }, { resource: 'books' }] as const)(
    'resource: $resource',
    ({ resource }) => {
      it('creates scalar meta fields', async () => {
        const harness = createResourceHarness(client, resource);
        const entry = await harness.create({
          title: `Client Meta Scalars: ${resource}`,
          status: 'draft',
          meta: {
            test_string_meta: 'hello world',
            test_boolean_meta: true,
            test_integer_meta: 42,
            test_number_meta: 3.14,
          },
        });

        createdIds[resource].push(getEntryId(entry));

        const meta = getMetaRecord(entry);
        expect(meta.test_string_meta).toBe('hello world');
        expect(meta.test_boolean_meta).toBe(true);
        expect(meta.test_integer_meta).toBe(42);
        expect(meta.test_number_meta).toBeCloseTo(3.14);
      });

      it('creates complex meta fields', async () => {
        const harness = createResourceHarness(client, resource);
        const entry = await harness.create({
          title: `Client Meta Complex: ${resource}`,
          status: 'draft',
          meta: {
            test_array_meta: ['alpha', 'beta', 'gamma'],
            test_object_meta: {
              city: 'Berlin',
              zip: '10115',
              lat: 52.52,
              lng: 13.405,
            },
          },
        });

        createdIds[resource].push(getEntryId(entry));

        const meta = getMetaRecord(entry);
        expect(meta.test_array_meta).toEqual(['alpha', 'beta', 'gamma']);
        expect(meta.test_object_meta).toEqual({
          city: 'Berlin',
          zip: '10115',
          lat: 52.52,
          lng: 13.405,
        });
      });

      it('reads persisted meta back from a fresh REST GET', async () => {
        const harness = createResourceHarness(client, resource);
        const entry = await harness.create({
          title: `Client Meta Readback: ${resource}`,
          status: 'draft',
          meta: {
            test_string_meta: 'readback',
            test_integer_meta: 7,
          },
        });

        const id = getEntryId(entry);
        createdIds[resource].push(id);

        const readBack = await fetchResource(resource, id);
        const meta = getMetaRecord(readBack);

        expect(meta.test_string_meta).toBe('readback');
        expect(meta.test_integer_meta).toBe(7);
      });

      it('updates one meta field without clobbering another', async () => {
        const harness = createResourceHarness(client, resource);
        const entry = await harness.create({
          title: `Client Meta Update: ${resource}`,
          status: 'draft',
          meta: {
            test_string_meta: 'before',
            test_integer_meta: 1,
          },
        });

        const id = getEntryId(entry);
        createdIds[resource].push(id);

        const updated = await harness.update(id, {
          meta: {
            test_string_meta: 'after',
          },
        });

        const meta = getMetaRecord(updated);
        expect(meta.test_string_meta).toBe('after');
        expect(meta.test_integer_meta).toBe(1);
      });
    },
  );

  it('replaces array meta values on update', async () => {
    const harness = createResourceHarness(client, 'posts');
    const entry = await harness.create({
      title: 'Client Meta Array Replace',
      status: 'draft',
      meta: {
        test_array_meta: ['one', 'two'],
      },
    });

    const id = getEntryId(entry);
    createdIds.posts.push(id);

    const updated = await harness.update(id, {
      meta: {
        test_array_meta: ['three'],
      },
    });

    expect(getMetaRecord(updated).test_array_meta).toEqual(['three']);
  });

  it('replaces object meta values on update', async () => {
    const harness = createResourceHarness(client, 'posts');
    const entry = await harness.create({
      title: 'Client Meta Object Replace',
      status: 'draft',
      meta: {
        test_object_meta: {
          city: 'Berlin',
          zip: '10115',
          lat: 52.52,
          lng: 13.405,
        },
      },
    });

    const id = getEntryId(entry);
    createdIds.posts.push(id);

    const updated = await harness.update(id, {
      meta: {
        test_object_meta: {
          city: 'Munich',
          zip: '80331',
          lat: 48.137,
          lng: 11.575,
        },
      },
    });

    expect(getMetaRecord(updated).test_object_meta).toEqual({
      city: 'Munich',
      zip: '80331',
      lat: 48.137,
      lng: 11.575,
    });
  });

  it('rejects writes to readonly registered meta fields', async () => {
    await expect(
      client.createPost({
        title: 'Client Meta Readonly Reject',
        status: 'draft',
        meta: {
          test_readonly_meta: 'should not save',
        },
      }),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
    });
  });

  it('stores book-only ISBN meta on the book custom post type', async () => {
    const harness = createResourceHarness(client, 'books');
    const entry = await harness.create({
      title: 'Client Meta Book ISBN',
      status: 'draft',
      meta: {
        test_book_isbn: '978-1-4028-9462-6',
      },
    });

    createdIds.books.push(getEntryId(entry));

    expect(getMetaRecord(entry).test_book_isbn).toBe('978-1-4028-9462-6');
  });

  it('rejects unauthenticated writes to registered meta fields', async () => {
    const publicClient = createPublicClient();

    await expect(
      publicClient.createPost({
        title: 'Client Meta Public Reject',
        status: 'draft',
        meta: {
          test_string_meta: 'nope',
        },
      }),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
    });
  });
});
