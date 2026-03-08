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
 * Normalizes one ACF payload to a plain object for assertions.
 */
function getAcfRecord(entry: unknown): Record<string, unknown> {
  const acf = (entry as { acf?: Record<string, unknown> | unknown[] }).acf;

  if (!acf || Array.isArray(acf)) {
    return {};
  }

  return acf;
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
 * Reads one resource by slug, with optional `_embed`, for seeded-data assertions.
 */
async function fetchResourceBySlug(
  resource: ResourceName,
  slug: string,
  embed = false,
): Promise<Record<string, unknown>> {
  const url = new URL(`${getBaseUrl()}/wp-json/wp/v2/${resource}`);
  url.searchParams.set('slug', slug);

  if (embed) {
    url.searchParams.set('_embed', '1');
  }

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(`Expected ${resource} slug '${slug}' to exist. Received ${response.status}.`);
  }

  const entries = await response.json() as Array<Record<string, unknown>>;
  const [entry] = entries;

  if (!entry) {
    throw new Error(`Expected ${resource} slug '${slug}' to resolve one entry.`);
  }

  return entry;
}

/**
 * Reads one resource by id, with optional `_embed`, for relation assertions.
 */
async function fetchResourceById(
  resource: ResourceName,
  id: number,
  embed = false,
): Promise<Record<string, unknown>> {
  const url = new URL(`${getBaseUrl()}/wp-json/wp/v2/${resource}/${id}`);

  if (embed) {
    url.searchParams.set('_embed', '1');
  }

  const response = await fetch(url, {
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
 * Resolves one seeded post id from its known slug.
 */
async function getPostIdBySlug(slug: string): Promise<number> {
  const entry = await fetchResourceBySlug('posts', slug);
  return getEntryId(entry);
}

/**
 * Extracts related post ids from `_links['acf:post']`.
 */
function getAcfLinkedPostIds(entry: Record<string, unknown>): number[] {
  const links = (entry._links as Record<string, unknown> | undefined)?.['acf:post'];

  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link) => {
      const href = (link as { href?: string }).href;

      if (!href) {
        return null;
      }

      const id = Number(new URL(href).pathname.split('/').pop());
      return Number.isInteger(id) ? id : null;
    })
    .filter((id): id is number => id !== null);
}

/**
 * Extracts related post ids from `_embedded['acf:post']`.
 */
function getAcfEmbeddedPostIds(entry: Record<string, unknown>): number[] {
  const embedded = (entry._embedded as Record<string, unknown> | undefined)?.['acf:post'];

  if (!Array.isArray(embedded)) {
    return [];
  }

  return embedded
    .map((item) => (item as { id?: number }).id)
    .filter((id): id is number => typeof id === 'number');
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
 * Integration coverage for ACF REST fields through the standalone client package.
 */
describe('Client: ACF fields', () => {
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

  it('reads seeded scalar ACF fields on posts', async () => {
    const post = await fetchResourceBySlug('posts', 'test-post-001');
    const acf = getAcfRecord(post);

    expect(acf.acf_subtitle).toBe('Subtitle for test post 001');
    expect(acf.acf_summary).toBe('Summary content for test post 001. Deterministic seed data.');
    expect(acf.acf_priority_score).toBe(10);
    expect(acf.acf_external_url).toBe('https://example.com/test-post-001');
  });

  it('reads seeded scalar ACF fields on pages', async () => {
    const page = await fetchResourceBySlug('pages', 'about');
    const acf = getAcfRecord(page);

    expect(acf.acf_subtitle).toBe('Subtitle for about page');
    expect(acf.acf_priority_score).toBe(20);
    expect(acf.acf_external_url).toBe('https://example.com/about');
  });

  it('reads seeded scalar and relation ACF fields on books', async () => {
    const book = await fetchResourceBySlug('books', 'test-book-001', true);
    const acf = getAcfRecord(book);
    const featuredId = await getPostIdBySlug('test-post-005');

    expect(acf.acf_subtitle).toBe('Subtitle for test book 001');
    expect(acf.acf_priority_score).toBe(15);
    expect(acf.acf_featured_post).toBe(featuredId);
    expect(getAcfLinkedPostIds(book)).toEqual(expect.arrayContaining([featuredId]));
    expect(getAcfEmbeddedPostIds(book)).toEqual(expect.arrayContaining([featuredId]));
  });

  it('reads seeded post relations and embed links through ACF', async () => {
    const post = await fetchResourceBySlug('posts', 'test-post-001', true);
    const acf = getAcfRecord(post);
    const expectedRelatedIds = await Promise.all([
      getPostIdBySlug('test-post-002'),
      getPostIdBySlug('test-post-003'),
      getPostIdBySlug('test-post-011'),
    ]);

    expect(acf.acf_related_posts).toEqual(expect.arrayContaining(expectedRelatedIds.slice(0, 2)));
    expect(acf.acf_featured_post).toBe(expectedRelatedIds[2]);
    expect(getAcfLinkedPostIds(post)).toEqual(expect.arrayContaining(expectedRelatedIds));
    expect(getAcfEmbeddedPostIds(post)).toEqual(expect.arrayContaining(expectedRelatedIds));
  });

  describe.each([{ resource: 'posts' }, { resource: 'pages' }, { resource: 'books' }] as const)(
    'resource: $resource',
    ({ resource }) => {
      it('creates scalar ACF fields', async () => {
        const harness = createResourceHarness(client, resource);
        const entry = await harness.create({
          title: `Client ACF Scalars: ${resource}`,
          status: 'draft',
          acf: {
            acf_subtitle: `${resource} subtitle`,
            acf_summary: `${resource} summary`,
            acf_priority_score: 55,
            acf_external_url: `https://example.com/${resource}`,
          },
        });

        createdIds[resource].push(getEntryId(entry));

        const acf = getAcfRecord(entry);
        expect(acf.acf_subtitle).toBe(`${resource} subtitle`);
        expect(acf.acf_summary).toBe(`${resource} summary`);
        expect(acf.acf_priority_score).toBe(55);
      });
    },
  );

  it('creates relation ACF fields as numeric post ids', async () => {
    const harness = createResourceHarness(client, 'posts');
    const [relatedId1, relatedId2, featuredId] = await Promise.all([
      getPostIdBySlug('test-post-003'),
      getPostIdBySlug('test-post-004'),
      getPostIdBySlug('test-post-020'),
    ]);

    const entry = await harness.create({
      title: 'Client ACF Relations',
      status: 'draft',
      acf: {
        acf_related_posts: [relatedId1, relatedId2],
        acf_featured_post: featuredId,
      },
    });

    const id = getEntryId(entry);
    createdIds.posts.push(id);

    const acf = getAcfRecord(entry);
    expect(acf.acf_related_posts).toEqual(expect.arrayContaining([relatedId1, relatedId2]));
    expect(acf.acf_featured_post).toBe(featuredId);

    const readBack = await fetchResourceById('posts', id, true);
    expect(getAcfRecord(readBack).acf_related_posts).toEqual(expect.arrayContaining([relatedId1, relatedId2]));
    expect(getAcfRecord(readBack).acf_featured_post).toBe(featuredId);
    expect(getAcfLinkedPostIds(readBack)).toEqual(expect.arrayContaining([relatedId1, relatedId2, featuredId]));
    expect(getAcfEmbeddedPostIds(readBack)).toEqual(expect.arrayContaining([relatedId1, relatedId2, featuredId]));
  });

  it('updates scalar ACF fields without clobbering untouched values', async () => {
    const harness = createResourceHarness(client, 'posts');
    const entry = await harness.create({
      title: 'Client ACF Scalar Update',
      status: 'draft',
      acf: {
        acf_subtitle: 'before',
        acf_priority_score: 10,
      },
    });

    const id = getEntryId(entry);
    createdIds.posts.push(id);

    const updated = await harness.update(id, {
      acf: {
        acf_subtitle: 'after',
      },
    });

    const acf = getAcfRecord(updated);
    expect(acf.acf_subtitle).toBe('after');
    expect(acf.acf_priority_score).toBe(10);
  });

  it('updates ACF relation ids and returns updated embed data on refetch', async () => {
    const harness = createResourceHarness(client, 'posts');
    const [relatedId, featuredId] = await Promise.all([
      getPostIdBySlug('test-post-031'),
      getPostIdBySlug('test-post-040'),
    ]);

    const entry = await harness.create({
      title: 'Client ACF Relation Update',
      status: 'draft',
      acf: {
        acf_related_posts: [relatedId],
      },
    });

    const id = getEntryId(entry);
    createdIds.posts.push(id);

    await harness.update(id, {
      acf: {
        acf_related_posts: [relatedId],
        acf_featured_post: featuredId,
      },
    });

    const readBack = await fetchResourceById('posts', id, true);
    expect(getAcfRecord(readBack).acf_related_posts).toEqual(expect.arrayContaining([relatedId]));
    expect(getAcfRecord(readBack).acf_featured_post).toBe(featuredId);
    expect(getAcfLinkedPostIds(readBack)).toEqual(expect.arrayContaining([relatedId, featuredId]));
    expect(getAcfEmbeddedPostIds(readBack)).toEqual(expect.arrayContaining([relatedId, featuredId]));
  });

  it('rejects unauthenticated ACF writes', async () => {
    const publicClient = createPublicClient();

    await expect(
      publicClient.createPost({
        title: 'Client ACF Public Reject',
        status: 'draft',
        acf: {
          acf_subtitle: 'should fail',
        },
      }),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
    });
  });
});
