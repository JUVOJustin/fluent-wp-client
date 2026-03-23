import { beforeAll, describe, expect, it } from 'vitest';
import {
  WordPressClient,
  WordPressSchemaValidationError,
  contentWordPressSchema,
  postLikeWordPressSchema,
} from 'fluent-wp-client';
import { createPublicClient } from '../helpers/wp-client';

/**
 * Seed data: 3 sparse artifacts registered through the `artifact` custom post type.
 *
 * This suite verifies that generic content reads default to the flexible
 * post-like schema when a custom post type disables title and editor support.
 */
describe('Client: Artifacts', () => {
  let publicClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
  });

  describe('reads', () => {
    it('getContentCollection returns sparse artifacts without title or content fields', async () => {
      const artifacts = await publicClient.getContentCollection('artifacts');

      expect(Array.isArray(artifacts)).toBe(true);
      expect(artifacts).toHaveLength(3);

      const firstArtifact = artifacts[0];

      expect(firstArtifact?.type).toBe('artifact');
      expect(firstArtifact).not.toHaveProperty('title');
      expect(firstArtifact).not.toHaveProperty('content');
      expect(firstArtifact).not.toHaveProperty('excerpt');
      expect(firstArtifact).not.toHaveProperty('author');
      expect(firstArtifact).toHaveProperty('acf.acf_subtitle');
    });

    it('getContentBySlug fetches one known sparse artifact', async () => {
      const artifact = await publicClient.getContentBySlug('artifacts', 'test-artifact-001');

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
      const artifact = await artifacts.getBySlug('test-artifact-001');

      expect(all).toHaveLength(3);
      expect(all[0]).not.toHaveProperty('title');
      expect(all[0]).not.toHaveProperty('content');
      expect(artifact?.slug).toBe('test-artifact-001');
      expect(artifact).toHaveProperty('acf.acf_subtitle', 'Subtitle for test artifact 001');
    });

    it('content() throws a validation error when content-bearing fields are required', async () => {
      const artifacts = publicClient.content('artifacts', contentWordPressSchema);

      try {
        await artifacts.getBySlug('test-artifact-001');
        throw new Error('Expected sparse artifact validation to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(WordPressSchemaValidationError);
        expect((error as Error).message).toMatch(/title|author|content|excerpt/i);
      }
    });
  });
});
