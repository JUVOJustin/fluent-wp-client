import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for the fluent media client.
 *
 * Seed data contains no media items, so the suite covers empty-state reads,
 * schema discovery, and an authenticated upload lifecycle.
 */
describe('Client: Media', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  const createdMediaIds: number[] = [];

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdMediaIds) {
      await authClient.media().delete(id, { force: true }).catch(() => undefined);
    }
  });

  it('media().list returns an empty array when no media exists', async () => {
    const media = await publicClient.media().list();

    expect(Array.isArray(media)).toBe(true);
    expect(media).toHaveLength(0);
  });

  it('media().listAll returns an empty array when no media exists', async () => {
    const media = await publicClient.media().listAll();

    expect(Array.isArray(media)).toBe(true);
    expect(media).toHaveLength(0);
  });

  it('media().listPaginated returns pagination metadata with zero results', async () => {
    const result = await publicClient.media().listPaginated({ perPage: 1, page: 1 });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('totalPages');
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(1);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('media().get throws for a non-existent numeric ID', async () => {
    await expect(publicClient.media().get(999999)).rejects.toThrow();
  });

  it('media().get returns undefined for a non-existent slug', async () => {
    const item = await publicClient.media().get('nonexistent-media-999');

    expect(item).toBeUndefined();
  });

  it('media().describe returns schema metadata', async () => {
    const description = await authClient.media().describe();

    expect(description.kind).toBe('resource');
    expect(description.resource).toBe('media');
    expect(description.route).toBe('/wp-json/wp/v2/media');
    expect(description.schemas.item).toBeDefined();
    expect(description.schemas.collection).toBeDefined();
  });

  it('media().upload supports fetch, update, delete, and image URL helpers', async () => {
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

    const media = await authClient.media().upload({
      file: png1x1,
      filename: 'media-client-1x1.png',
      mimeType: 'image/png',
      title: 'Media Client Test Upload',
      alt_text: 'Media client test image',
    });

    createdMediaIds.push(media.id);

    expect(media.id).toBeGreaterThan(0);
    expect(media.media_type).toBe('image');
    expect(authClient.media().getImageUrl(media)).toBe(media.source_url);
    expect(authClient.media().getImageUrl(media, 'nonexistent-size')).toBe(media.source_url);

    const byId = await authClient.media().get(media.id);
    expect(byId.id).toBe(media.id);

    const bySlug = await authClient.media().get(media.slug);
    expect(bySlug?.id).toBe(media.id);

    const updated = await authClient.media().update(media.id, {
      caption: 'Updated media client caption',
    });

    expect(updated.caption.rendered).toContain('Updated media client caption');

    const deleted = await authClient.media().delete(media.id, { force: true });
    expect(deleted.deleted).toBe(true);
  });
});
