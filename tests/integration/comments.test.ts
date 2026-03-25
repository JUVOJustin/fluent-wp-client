import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for fluent comment reads, CRUD, and schema discovery.
 */
describe('Client: Comments', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let seedPostId = 0;
  let seedCommentId = 0;
  const createdCommentIds: number[] = [];

  beforeAll(async () => {
    publicClient = createPublicClient();
    authClient = createAuthClient();

    const seedPost = await authClient.content('posts').item('test-post-001');

    if (!seedPost) {
      throw new Error('Expected seeded post test-post-001 for comment integration coverage.');
    }

    seedPostId = seedPost.id;

    const seedComment = await authClient.comments().create({
      post: seedPostId,
      content: 'Client Comments: seeded comment',
      status: 'approve',
    });

    seedCommentId = seedComment.id;
    createdCommentIds.push(seedComment.id);
  });

  afterAll(async () => {
    for (const id of createdCommentIds) {
      await authClient.comments().delete(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('comments().list returns an array that includes the seeded comment', async () => {
      const comments = await publicClient.comments().list({ post: seedPostId });

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.some((comment) => comment.id === seedCommentId)).toBe(true);
    });

    it('comments().item fetches the seeded comment by ID', async () => {
      const comment = await publicClient.comments().item(seedCommentId);

      if (!comment) {
        throw new Error('Expected seeded comment to exist.');
      }

      expect(comment.id).toBe(seedCommentId);
      expect(comment.post).toBe(seedPostId);
      expect(comment.content.rendered).toContain('Client Comments: seeded comment');
    });

    it('comments().item().with hydrates author and post relations', async () => {
      const comment = await authClient.comments().item(seedCommentId).with('author', 'post');

      expect(comment?.related.author).toBeTruthy();
      expect(comment?.related.author?.slug).toBe('admin');
      expect(comment?.related.post).toBeTruthy();
      expect(comment?.related.post?.slug).toBe('test-post-001');
    });

    it('comments().listAll returns the seeded comment', async () => {
      const comments = await publicClient.comments().listAll();

      expect(comments.some((comment) => comment.id === seedCommentId)).toBe(true);
    });

    it('comments().listPaginated returns pagination metadata', async () => {
      const result = await publicClient.comments().listPaginated({ perPage: 1, page: 1, post: seedPostId });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(1);
    });

    it('comments().describe returns schema metadata', async () => {
      const description = await authClient.comments().describe();

      expect(description.kind).toBe('resource');
      expect(description.resource).toBe('comments');
      expect(description.route).toBe('/wp-json/wp/v2/comments');
      expect(description.schemas.item).toBeDefined();
      expect(description.schemas.collection).toBeDefined();
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes comments', async () => {
      const created = await authClient.comments().create({
        post: seedPostId,
        content: 'Client CRUD comment body',
        status: 'approve',
      });

      createdCommentIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.post).toBe(seedPostId);

      const updated = await authClient.comments().update(created.id, {
        content: 'Client CRUD comment body updated',
      });

      expect(updated.content.rendered).toContain('updated');

      const deleted = await authClient.comments().delete(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });
  });
});
