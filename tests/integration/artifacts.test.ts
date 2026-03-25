import { beforeAll, describe, expect, it } from 'vitest';
import {
  WordPressClient,
  WordPressSchemaValidationError,
  contentWordPressSchema,
  postLikeWordPressSchema,
} from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Seed data: 3 sparse artifacts registered through the `artifact` custom post type.
 *
 * Verifies that generic content reads default to the flexible post-like schema
 * when a CPT disables title and editor support, and that strict schemas fail
 * fast on both reads and mutations.
 */
describe('Client: Artifacts', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  describe('reads', () => {
    it('content() list() returns sparse artifacts without title or content fields', async () => {
      const artifacts = await publicClient.content('artifacts').list();

      expect(Array.isArray(artifacts)).toBe(true);
      expect(artifacts).toHaveLength(3);

      const first = artifacts[0];

      expect(first?.type).toBe('artifact');
      expect(first).not.toHaveProperty('title');
      expect(first).not.toHaveProperty('content');
      expect(first).not.toHaveProperty('excerpt');
      expect(first).not.toHaveProperty('author');
      expect(first).toHaveProperty('acf.acf_subtitle');
    });

    it('content() item fetches one known sparse artifact', async () => {
      const artifact = await publicClient.content('artifacts').item('test-artifact-001');

      expect(artifact).toBeDefined();
      expect(artifact?.slug).toBe('test-artifact-001');
      expect(artifact?.type).toBe('artifact');
      expect(artifact).not.toHaveProperty('title');
      expect(artifact).not.toHaveProperty('content');
      expect(artifact).toHaveProperty('acf.acf_subtitle', 'Subtitle for test artifact 001');
    });

    it('content() validates sparse artifacts with the flexible post-like schema', async () => {
      const artifacts = publicClient.content('artifacts', postLikeWordPressSchema);
      const all = await artifacts.listAll();
      const artifact = await artifacts.item('test-artifact-001');

      expect(all).toHaveLength(3);
      expect(all[0]).not.toHaveProperty('title');
      expect(all[0]).not.toHaveProperty('content');
      expect(artifact?.slug).toBe('test-artifact-001');
      expect(artifact).toHaveProperty('acf.acf_subtitle', 'Subtitle for test artifact 001');
    });

    it('content() throws a validation error on reads when a strict content schema is used', async () => {
      const artifacts = publicClient.content('artifacts', contentWordPressSchema);

      try {
        await artifacts.item('test-artifact-001');
        // Should not reach here
        expect.fail('Expected validation error but got successful response');
      } catch (error) {
        expect(error).toBeInstanceOf(WordPressSchemaValidationError);
      }
    });
  });

  describe('mutations', () => {
    it('content() throws a validation error on update when a strict content schema is used', async () => {
      const artifact = await publicClient.content('artifacts').item('test-artifact-001');
      expect(artifact).toBeDefined();

      const strictArtifacts = authClient.content('artifacts', contentWordPressSchema);

      // The HTTP PATCH succeeds but the sparse response fails contentWordPressSchema validation.
      await expect(
        strictArtifacts.update(artifact!.id, { status: 'publish' }),
      ).rejects.toBeInstanceOf(WordPressSchemaValidationError);
    });
  });
});
