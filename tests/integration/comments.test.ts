import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for comment reads and CRUD against the real REST API.
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

    const seedPost = await authClient.content('posts').getBySlug('test-post-001');

    if (!seedPost) {
      throw new Error('Expected seeded post test-post-001 for comment integration coverage.');
    }

    seedPostId = seedPost.id;

    const seedComment = await authClient.createComment({
      post: seedPostId,
      content: 'Client Comments: seeded comment',
      status: 'approve',
    });

    seedCommentId = seedComment.id;
    createdCommentIds.push(seedComment.id);
  });

  afterAll(async () => {
    for (const id of createdCommentIds) {
      await authClient.deleteComment(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('getComments returns an array that includes the seeded comment', async () => {
      const comments = await publicClient.getComments({ post: seedPostId });

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.some((comment) => comment.id === seedCommentId)).toBe(true);
    });

    it('getComment fetches the seeded comment by ID', async () => {
      const comment = await publicClient.getComment(seedCommentId);

      expect(comment.id).toBe(seedCommentId);
      expect(comment.post).toBe(seedPostId);
      expect(comment.content.rendered).toContain('Client Comments: seeded comment');
    });

    it('getAllComments returns the seeded comment', async () => {
      const comments = await publicClient.getAllComments();

      expect(comments.some((comment) => comment.id === seedCommentId)).toBe(true);
    });

    it('getCommentsPaginated returns pagination metadata', async () => {
      const result = await publicClient.getCommentsPaginated({ perPage: 1, page: 1, post: seedPostId });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(1);
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes comments', async () => {
      const created = await authClient.createComment({
        post: seedPostId,
        content: 'Client CRUD comment body',
        status: 'approve',
      });

      createdCommentIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.post).toBe(seedPostId);

      const updated = await authClient.updateComment(created.id, {
        content: 'Client CRUD comment body updated',
      });

      expect(updated.content.rendered).toContain('updated');

      const deleted = await authClient.deleteComment(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });
  });
});
