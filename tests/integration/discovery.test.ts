import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { z } from 'zod';
import { createAuthClient } from '../helpers/wp-client';

/**
 * Integration tests for JSON Schema discovery APIs.
 *
 * These tests verify the discovery functionality that exposes payload shapes
 * for WordPress REST resources and abilities.
 */
describe('Discovery APIs', () => {
  let authClient: WordPressClient;

  beforeAll(() => {
    // Discovery requires authentication to access /types and /taxonomies endpoints
    authClient = createAuthClient();
  });

  describe('wp.content().describe()', () => {
    it('returns schema description for posts', async () => {
      const description = await authClient.content('posts').describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe('content');
      expect(description.resource).toBe('posts');
      expect(description.namespace).toBe('wp/v2');
      expect(description.route).toBe('/wp-json/wp/v2/posts');
      expect(description.schemas).toBeDefined();
      expect(description.schemas.item).toBeDefined();
      expect(description.schemas.collection).toBeDefined();
      // Note: create/update schemas may not be available depending on WP version/permissions
    });

    it('returns schema description for pages', async () => {
      const description = await authClient.content('pages').describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe('content');
      expect(description.resource).toBe('pages');
      expect(description.schemas).toBeDefined();
    });

    it('returns schema description for custom post types', async () => {
      const description = await authClient.content('books').describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe('content');
      expect(description.resource).toBe('books');
      expect(description.schemas).toBeDefined();
    });

    it('returns serializable resource descriptions without dropping schema keys', async () => {
      const description = await authClient.content('posts').describe();

      expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    });
  });

  describe('wp.terms().describe()', () => {
    it('returns schema description for categories', async () => {
      const description = await authClient.terms('categories').describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe('term');
      expect(description.resource).toBe('categories');
      expect(description.namespace).toBe('wp/v2');
      expect(description.schemas).toBeDefined();
      expect(description.schemas.item).toBeDefined();
      expect(description.schemas.collection).toBeDefined();
    });

    it('returns schema description for tags', async () => {
      const description = await authClient.terms('tags').describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe('term');
      expect(description.resource).toBe('tags');
      expect(description.schemas).toBeDefined();
    });
  });

  describe('wp.ability().describe()', () => {
    it('returns schema description for an ability', async () => {
      const description = await authClient.ability('test/process-complex').describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe('ability');
      expect(description.name).toBe('test/process-complex');
      expect(description.route).toContain('/wp-json/wp-abilities/v1/abilities/test/process-complex');
      expect(description.schemas).toBeDefined();
    });

    it('returns serializable ability descriptions without dropping schema keys', async () => {
      const description = await authClient.ability('test/process-complex').describe();

      expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    });
  });

  describe('wp.explore()', () => {
    it('returns full catalog of discoverable resources', async () => {
      const catalog = await authClient.explore();

      expect(catalog).toBeDefined();
      expect(catalog.content).toBeDefined();
      expect(catalog.terms).toBeDefined();
      expect(catalog.resources).toBeDefined();
      expect(catalog.abilities).toBeDefined();

      // Verify posts are discovered
      expect(catalog.content.posts).toBeDefined();
      expect(catalog.content.posts.kind).toBe('content');
      expect(catalog.content.posts.schemas).toBeDefined();

      // Verify pages are discovered
      expect(catalog.content.pages).toBeDefined();

      // Verify books (custom post type) are discovered
      expect(catalog.content.books).toBeDefined();

      // Verify terms are discovered
      expect(catalog.terms.categories).toBeDefined();
      expect(catalog.terms.tags).toBeDefined();

      // Verify first-class resources are discovered
      expect(catalog.resources.media).toBeDefined();
      expect(catalog.resources.users).toBeDefined();
      expect(catalog.resources.comments).toBeDefined();
      expect(catalog.resources.settings).toBeDefined();
    });

    it('supports include option to limit discovery scope', async () => {
      const catalog = await authClient.explore({ include: ['content'] });

      expect(catalog).toBeDefined();
      expect(Object.keys(catalog.content).length).toBeGreaterThan(0);
      expect(Object.keys(catalog.terms).length).toBe(0);
      expect(Object.keys(catalog.resources).length).toBe(0);
      expect(Object.keys(catalog.abilities).length).toBe(0);
    });

    it('does not treat a partial explore() result as the cached full catalog', async () => {
      const client = createAuthClient();

      const partialCatalog = await client.explore({ include: ['content'] });
      expect(Object.keys(partialCatalog.terms).length).toBe(0);

      const fullCatalog = await client.explore();
      expect(Object.keys(fullCatalog.terms).length).toBeGreaterThan(0);
      expect(Object.keys(fullCatalog.resources).length).toBeGreaterThan(0);
      expect(Object.keys(fullCatalog.abilities).length).toBeGreaterThan(0);
    });

    it('returns serializable DTOs', async () => {
      const catalog = await authClient.explore();

      // Test structuredClone compatibility
      const cloned = structuredClone(catalog);
      expect(cloned).toEqual(catalog);

      // Test JSON serialization
      const json = JSON.stringify(catalog);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(catalog);

      // Ensure no functions in catalog
      expect(typeof catalog.content.posts.schemas).toBe('object');
      expect(typeof JSON.parse(JSON.stringify(catalog.content.posts.schemas))).toBe('object');
    });
  });

  /**
   * Dogfooding tests: Verify discovered schemas can be used with Zod
   */
  describe('Dogfooding: Using discovered schemas', () => {
    it('converts discovered schemas to Zod when available', async () => {
      const description = await authClient.content('posts').describe();
      
      // If create schema is available, it should be convertible to Zod
      if (description.schemas.create) {
        const createSchema = z.fromJSONSchema(description.schemas.create);
        expect(createSchema).toBeDefined();
      }
      
      // If item schema is available, it should be convertible to Zod
      if (description.schemas.item) {
        const itemSchema = z.fromJSONSchema(description.schemas.item);
        expect(itemSchema).toBeDefined();
      }
    });

    it('uses discovered schemas for validation when available', async () => {
      const createdIds: number[] = [];
      
      try {
        // Get books schema (more likely to have create schema than posts)
        const description = await authClient.content('books').describe();
        
        if (description.schemas.create) {
          // Convert to Zod and use for validation
          const createSchema = z.fromJSONSchema(description.schemas.create);
          
          // Valid input should work
          const book = await authClient.content('books').create(
            {
              title: 'Dogfooding Test Book',
              content: 'Created with schema validation',
              status: 'draft',
            },
            createSchema
          ) as { id: number; type: string };
          
          expect(book).toBeDefined();
          expect(book.type).toBe('book');
          createdIds.push(book.id);
          
          // Invalid input should fail validation
          await expect(
            authClient.content('books').create(
              { content: 'Missing title' } as any,
              createSchema
            )
          ).rejects.toThrow();
        }
      } finally {
        // Cleanup
        for (const id of createdIds) {
          await authClient.content('books').delete(id, { force: true }).catch(() => undefined);
        }
      }
    });
  });
});
