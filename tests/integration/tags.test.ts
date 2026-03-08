import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Seed data: 8 tags (featured, trending, tutorial, review, guide, news, opinion, update).
 */
describe('Client: Tags', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let seededTagIds: number[] = [];
  const createdTagIds: number[] = [];

  beforeAll(async () => {
    publicClient = createPublicClient();
    authClient = createAuthClient();

    const seedSlugs = ['featured', 'trending', 'tutorial', 'review', 'guide', 'news', 'opinion', 'update'];
    const seedTags = await Promise.all(seedSlugs.map((slug) => publicClient.getTagBySlug(slug)));

    seededTagIds = seedTags
      .map((tag) => tag?.id)
      .filter((id): id is number => typeof id === 'number');
  });

  afterAll(async () => {
    for (const id of createdTagIds) {
      await authClient.deleteTag(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('getTags returns an array', async () => {
      const tags = await publicClient.getTags();

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
    });

    it('every tag has required fields', async () => {
      const tags = await publicClient.getTags();

      for (const tag of tags) {
        expect(tag).toHaveProperty('id');
        expect(tag).toHaveProperty('name');
        expect(tag).toHaveProperty('slug');
        expect(tag).toHaveProperty('count');
        expect(tag).toHaveProperty('taxonomy');
        expect(tag.taxonomy).toBe('post_tag');
      }
    });

    it('getTagBySlug fetches a known seed tag', async () => {
      const tag = await publicClient.getTagBySlug('featured');

      expect(tag).toBeDefined();
      expect(tag!.slug).toBe('featured');
      expect(tag!.name).toBe('Featured');
      expect(tag!.count).toBe(60);
    });

    it('getTagBySlug returns undefined for non-existent slug', async () => {
      const tag = await publicClient.getTagBySlug('nonexistent-tag-999');

      expect(tag).toBeUndefined();
    });

    it('getAllTags returns all 8 tags', async () => {
      const all = await publicClient.getAllTags({ include: seededTagIds });

      expect(all).toHaveLength(8);

      const slugs = all.map((t) => t.slug).sort();
      expect(slugs).toEqual([
        'featured', 'guide', 'news', 'opinion',
        'review', 'trending', 'tutorial', 'update',
      ]);
    });

    it('getTagsPaginated returns pagination metadata', async () => {
      const result = await publicClient.getTagsPaginated({
        include: seededTagIds,
        perPage: 3,
        page: 1,
      });

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(8);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(1);
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes tags', async () => {
      const created = await authClient.createTag({
        name: 'client-crud-tag',
        description: 'Tag created by integration tests.',
      });

      createdTagIds.push(created.id);

      expect(created.name).toBe('client-crud-tag');
      expect(created.taxonomy).toBe('post_tag');

      const updated = await authClient.updateTag(created.id, {
        name: 'client-crud-tag-updated',
      });

      expect(updated.name).toBe('client-crud-tag-updated');

      const deleted = await authClient.deleteTag(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });

    it('throws for unauthenticated tag creation', async () => {
      await expect(
        publicClient.createTag({
          name: 'client-crud-public-tag',
        }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });

    it('throws for a non-existent tag on update', async () => {
      await expect(
        authClient.updateTag(999999, { name: 'Ghost Tag' }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });
  });
});
