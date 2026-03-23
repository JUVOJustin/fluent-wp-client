import { beforeAll, describe, expect, it, afterAll } from 'vitest';
import {
  WordPressClient,
  contentWordPressSchema,
  createAcfPostObjectRelation,
  createAcfRelationshipRelation,
  createAcfTaxonomyRelation,
  createIdCollectionRelation,
  createIdSingleRelation,
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
  customRelationRegistry,
  resolvePostReference,
  resolvePostReferences,
  resolveTermReference,
  resolveTermReferences,
  type CustomRelationConfig,
} from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for extensible custom relation resolvers.
 * 
 * Tests:
 * - ACF field-type relation hydration via the fluent API
 * - Public shared link/embed factory coverage
 * - Custom relation registration and resolution
 * - ACF taxonomy helper coverage
 * - Fallback mechanisms for custom relations
 * - Mixed built-in and custom relations
 */
describe('Client: Custom Relation Resolvers', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  const acfRelationshipRelationName = 'relatedEntries';
  const acfPostObjectRelationName = 'selectedEntry';
  const acfTaxonomyRelationName = 'selectedGenres';
  
  // Track custom relations for cleanup
  const registeredCustomRelations: string[] = [];
  const createdGenreIds: number[] = [];
  const createdBookIds: number[] = [];
  const createdPostIds: number[] = [];

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();

    registerTestRelation(createAcfRelationshipRelation({
      relationName: acfRelationshipRelationName,
      fieldName: 'acf_related_posts',
    }));
    registerTestRelation(createAcfPostObjectRelation({
      relationName: acfPostObjectRelationName,
      fieldName: 'acf_featured_post',
      multiple: false,
    }));
    registerTestRelation(createAcfTaxonomyRelation({
      relationName: acfTaxonomyRelationName,
      fieldName: 'acf_related_genres',
      resource: 'genre',
      multiple: true,
    }));
  });

  afterAll(async () => {
    // Clean up any custom relations we registered
    for (const name of registeredCustomRelations) {
      customRelationRegistry.unregister(name);
    }

    for (const id of createdPostIds) {
      await authClient.deletePost(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdBookIds) {
      await authClient.deleteContent('books', id, { force: true }).catch(() => undefined);
    }

    for (const id of createdGenreIds) {
      await authClient.deleteTerm('genre', id, { force: true }).catch(() => undefined);
    }
  });

  /**
   * Helper to register a custom relation and track it for cleanup.
   */
  function registerTestRelation<T>(config: CustomRelationConfig<T>): void {
    customRelationRegistry.register(config);
    registeredCustomRelations.push(config.name);
  }

  /**
   * Resolves one seeded post ID from a known slug.
   */
  async function getPostIdBySlug(slug: string): Promise<number> {
    const post = await authClient.getPostBySlug(slug);

    if (!post) {
      throw new Error(`Expected post '${slug}' to exist.`);
    }

    return post.id;
  }

  describe('ACF relation helpers', () => {
    it('hydrates ACF relationship fields with only the field-selected items', async () => {
      const [relatedId1, relatedId2, unrelatedId] = await Promise.all([
        getPostIdBySlug('test-post-002'),
        getPostIdBySlug('test-post-003'),
        getPostIdBySlug('test-post-011'),
      ]);

      const post = await authClient
        .post('test-post-001')
        .with(acfRelationshipRelationName)
        .get();

      expect(post.slug).toBe('test-post-001');
      const relatedPosts = post.related[acfRelationshipRelationName] as Array<{ id: number; slug?: string }>;

      expect(Array.isArray(relatedPosts)).toBe(true);
      expect(relatedPosts.map((related) => related.id)).toEqual([relatedId1, relatedId2]);
      expect(relatedPosts.some((related) => related.id === unrelatedId)).toBe(false);
    });

    it('hydrates ACF post_object fields with only the configured field item', async () => {
      const expectedId = await getPostIdBySlug('test-post-011');

      const post = await authClient
        .post('test-post-001')
        .with(acfPostObjectRelationName)
        .get();

      const selectedPost = post.related[acfPostObjectRelationName] as { id: number; slug?: string } | null;

      expect(post.slug).toBe('test-post-001');
      expect(selectedPost).not.toBeNull();
      expect(selectedPost?.id).toBe(expectedId);
    });

    it('resolves both ACF and built-in relations together', async () => {
      const post = await authClient
        .post('test-post-002')
        .with('author', 'categories', acfRelationshipRelationName, acfPostObjectRelationName)
        .get();

      // Built-in relations
      expect(post.related.author).toBeDefined();
      expect(Array.isArray(post.related.categories)).toBe(true);
      
      // ACF relations
      expect(Array.isArray(post.related[acfRelationshipRelationName])).toBe(true);
      expect(post.related[acfPostObjectRelationName] !== undefined).toBe(true);
    });

    it('falls back to fetching posts when embedded data is unavailable', async () => {
      // First, get the post without embed to test fallback
      const basePost = await authClient.getPostBySlug('test-post-001');
      expect(basePost).toBeDefined();
      
      // Verify ACF data exists
      const acf = (basePost as { acf?: Record<string, unknown> }).acf;
      expect(acf).toBeDefined();
      expect(acf?.acf_related_posts).toBeDefined();
      
      // Now use relation builder which should handle both embedded and fallback
      const post = await authClient
        .post('test-post-001')
        .with(acfRelationshipRelationName)
        .get();
      
      // Should still resolve the relation
      expect(Array.isArray(post.related[acfRelationshipRelationName])).toBe(true);
    });

    it('supports re-registering ACF helpers under custom relation names', async () => {
      registerTestRelation(createAcfRelationshipRelation({
        relationName: 'heroPosts',
        fieldName: 'acf_related_posts',
      }));
      registerTestRelation(createAcfPostObjectRelation({
        relationName: 'heroLinkedPost',
        fieldName: 'acf_featured_post',
        multiple: false,
      }));

      const post = await authClient
        .post('test-post-001')
        .with('heroPosts', 'heroLinkedPost')
        .get();

      expect(Array.isArray(post.related.heroPosts)).toBe(true);
      expect(post.related.heroLinkedPost !== undefined).toBe(true);
    });
  });

  describe('generic id-backed relation factories', () => {
    it('builds one collection relation from the generic ID-backed factory', async () => {
      registerTestRelation(createIdCollectionRelation({
        name: 'genericAcfRelatedPosts',
        embeddedKey: 'acf:post',
        extractEmbeddedItem: (item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const post = item as Record<string, unknown>;
          return typeof post.id === 'number' ? post as { id: number; slug?: string } : null;
        },
        getIds: (post) => (post as { acf?: Record<string, unknown> }).acf?.acf_related_posts,
        resolveMany: resolvePostReferences,
        requiredFields: ['acf'],
      }));

      const post = await authClient
        .post('test-post-001')
        .with('genericAcfRelatedPosts')
        .get();

      expect(Array.isArray(post.related.genericAcfRelatedPosts)).toBe(true);
      expect((post.related.genericAcfRelatedPosts as Array<{ id: number }>).length).toBeGreaterThan(0);
    });

    it('builds one single-item relation from the generic ID-backed factory', async () => {
      registerTestRelation(createIdSingleRelation({
        name: 'genericAcfPostObject',
        embeddedKey: 'acf:post',
        extractEmbeddedItem: (item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const post = item as Record<string, unknown>;
          return typeof post.id === 'number' ? post as { id: number; slug?: string } : null;
        },
        getId: (post) => (post as { acf?: Record<string, unknown> }).acf?.acf_featured_post,
        resolveOne: resolvePostReference,
        requiredFields: ['acf'],
      }));

      const post = await authClient
        .post('test-post-001')
        .with('genericAcfPostObject')
        .get();

      expect(post.related.genericAcfPostObject).not.toBeNull();
      expect(typeof (post.related.genericAcfPostObject as { id: number }).id).toBe('number');
    });
  });

  describe('shared link/embed relation factories', () => {
    it('builds one shared-bucket collection relation from the public factory', async () => {
      const [relatedId1, relatedId2, unrelatedId] = await Promise.all([
        getPostIdBySlug('test-post-002'),
        getPostIdBySlug('test-post-003'),
        getPostIdBySlug('test-post-011'),
      ]);

      registerTestRelation(createLinkedEmbeddedCollectionRelation({
        name: 'sharedBucketArticles',
        embeddedKey: 'acf:post',
        extractItem: (item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const post = item as Record<string, unknown>;
          return typeof post.id === 'number' ? post as { id: number; slug?: string } : null;
        },
        getIds: (post) => (post as { acf?: Record<string, unknown> }).acf?.acf_related_posts,
        resolveMany: resolvePostReferences,
        requiredFields: ['acf', '_links'],
      }));

      const post = await authClient
        .post('test-post-001')
        .with('sharedBucketArticles')
        .get();

      const related = post.related.sharedBucketArticles as Array<{ id: number }>;

      expect(related.map((item) => item.id)).toEqual([relatedId1, relatedId2]);
      expect(related.some((item) => item.id === unrelatedId)).toBe(false);
    });

    it('builds one shared-bucket single relation from the public factory', async () => {
      const expectedId = await getPostIdBySlug('test-post-011');

      registerTestRelation(createLinkedEmbeddedSingleRelation({
        name: 'sharedBucketPrimaryArticle',
        embeddedKey: 'acf:post',
        extractItem: (item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const post = item as Record<string, unknown>;
          return typeof post.id === 'number' ? post as { id: number; slug?: string } : null;
        },
        getId: (post) => (post as { acf?: Record<string, unknown> }).acf?.acf_featured_post,
        resolveOne: resolvePostReference,
        requiredFields: ['acf', '_links'],
      }));

      const post = await authClient
        .post('test-post-001')
        .with('sharedBucketPrimaryArticle')
        .get();

      expect((post.related.sharedBucketPrimaryArticle as { id: number } | null)?.id).toBe(expectedId);
    });

    it('builds one shared-bucket taxonomy relation from the public factory', async () => {
      const [first, second] = await Promise.all([
        authClient.createTerm('genre', {
          name: 'shared-bucket-genre-one',
          slug: 'shared-bucket-genre-one',
        }),
        authClient.createTerm('genre', {
          name: 'shared-bucket-genre-two',
          slug: 'shared-bucket-genre-two',
        }),
      ]);

      createdGenreIds.push(first.id, second.id);

      const created = await authClient.createPost({
        title: 'Shared Bucket Genres',
        status: 'draft',
        acf: {
          acf_related_genres: [first.id, second.id],
        },
      });

      createdPostIds.push(created.id);

      registerTestRelation(createLinkedEmbeddedCollectionRelation({
        name: 'sharedBucketGenres',
        embeddedKey: 'acf:term',
        extractItem: (item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const term = item as Record<string, unknown>;

          if (typeof term.id !== 'number' || typeof term.taxonomy !== 'string') {
            return null;
          }

          return {
            id: term.id,
            slug: String(term.slug ?? ''),
            name: String(term.name ?? ''),
            taxonomy: String(term.taxonomy ?? ''),
          };
        },
        getIds: (post) => (post as { acf?: Record<string, unknown> }).acf?.acf_related_genres,
        resolveMany: (client, ids) => resolveTermReferences(client, 'genre', ids),
        requiredFields: ['acf', '_links'],
      }));

      const hydrated = await authClient
        .post(created.id)
        .with('sharedBucketGenres')
        .get();

      const genres = hydrated.related.sharedBucketGenres as Array<{ id: number; taxonomy: string }>;

      expect(genres.map((genre) => genre.id)).toEqual([first.id, second.id]);
      expect(genres.every((genre) => genre.taxonomy === 'genre')).toBe(true);
    });
  });

  describe('term and custom term resolvers', () => {
    it('supports built-in taxonomy terms through the generic relation factory', async () => {
      registerTestRelation(createIdCollectionRelation({
        name: 'genericCategoryTerms',
        embeddedKey: 'wp:term',
        extractEmbeddedItem: (item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const term = item as Record<string, unknown>;

          if (term.taxonomy !== 'category' || typeof term.id !== 'number') {
            return null;
          }

          return {
            id: term.id,
            name: String(term.name ?? ''),
            slug: String(term.slug ?? ''),
            taxonomy: String(term.taxonomy ?? ''),
          };
        },
        getIds: (post) => post.categories,
        resolveMany: (client, ids) => resolveTermReferences(client, 'categories', ids),
        requiredFields: ['categories'],
      }));

      const post = await authClient
        .post('test-post-001')
        .with('genericCategoryTerms')
        .get();

      const terms = post.related.genericCategoryTerms as Array<{ taxonomy: string }>;
      expect(Array.isArray(terms)).toBe(true);
      expect(terms.length).toBeGreaterThan(0);
      expect(terms.every((term) => term.taxonomy === 'category')).toBe(true);
    });

    it('resolves one custom taxonomy term through the generic helper', async () => {
      const created = await authClient.createTerm('genre', {
        name: 'custom-relations-genre-single',
        slug: 'custom-relations-genre-single',
      });

      createdGenreIds.push(created.id);

      const term = await resolveTermReference(authClient, 'genre', created.id);

      expect(term).not.toBeNull();
      expect(term?.taxonomy).toBe('genre');
      expect(term?.slug).toBe('custom-relations-genre-single');
    });

    it('resolves many custom taxonomy terms through the generic helper', async () => {
      const first = await authClient.createTerm('genre', {
        name: 'custom-relations-genre-many-1',
        slug: 'custom-relations-genre-many-1',
      });
      const second = await authClient.createTerm('genre', {
        name: 'custom-relations-genre-many-2',
        slug: 'custom-relations-genre-many-2',
      });

      createdGenreIds.push(first.id, second.id);

      const terms = await resolveTermReferences(authClient, 'genre', [first.id, second.id]);

      expect(terms.length).toBe(2);
      expect(terms.every((term) => term.taxonomy === 'genre')).toBe(true);
      expect(terms.map((term) => term.slug)).toEqual(
        expect.arrayContaining(['custom-relations-genre-many-1', 'custom-relations-genre-many-2']),
      );
    });

    it('hydrates ACF taxonomy fields through the dedicated helper', async () => {
      const first = await authClient.createTerm('genre', {
        name: 'acf-taxonomy-helper-1',
        slug: 'acf-taxonomy-helper-1',
      });
      const second = await authClient.createTerm('genre', {
        name: 'acf-taxonomy-helper-2',
        slug: 'acf-taxonomy-helper-2',
      });

      createdGenreIds.push(first.id, second.id);

      const created = await authClient.createPost({
        title: 'Client ACF Taxonomy Relation',
        status: 'draft',
        acf: {
          acf_related_genres: [first.id, second.id],
        },
      });

      createdPostIds.push(created.id);

      const hydrated = await authClient
        .post(created.id)
        .with(acfTaxonomyRelationName)
        .get();

      const genres = hydrated.related[acfTaxonomyRelationName] as Array<{ id: number; taxonomy: string }>;

      expect(genres.map((genre) => genre.id)).toEqual([first.id, second.id]);
      expect(genres.every((genre) => genre.taxonomy === 'genre')).toBe(true);
    });
  });

  describe('custom content entity relation builders', () => {
    it('hydrates relations for custom post types through content().item()', async () => {
      registerTestRelation(createAcfPostObjectRelation({
        relationName: 'bookLinkedPost',
        fieldName: 'acf_featured_post',
        multiple: false,
      }));

      const book = await authClient
        .content('books', contentWordPressSchema)
        .item('test-book-001')
        .with('author', 'bookLinkedPost')
        .get();

      expect(book.slug).toBe('test-book-001');
      expect(book.related.author !== undefined).toBe(true);
      expect(book.related.bookLinkedPost !== undefined).toBe(true);
    });

    it('hydrates custom taxonomy terms for custom post types through content().getWithRelations()', async () => {
      const genre = await authClient.createTerm('genre', {
        name: 'custom-relations-book-genre',
        slug: 'custom-relations-book-genre',
      });
      createdGenreIds.push(genre.id);

      const book = await authClient.content('books', contentWordPressSchema).create({
        title: 'Custom Relations: Book Terms',
        status: 'draft',
        genre: [genre.id],
      });
      createdBookIds.push(book.id);

      const hydrated = await authClient
        .content('books', contentWordPressSchema)
        .getWithRelations(book.id, 'terms');

      expect(hydrated.related.terms.taxonomies.genre).toBeDefined();
      expect(hydrated.related.terms.taxonomies.genre?.length).toBeGreaterThan(0);
      expect(hydrated.related.terms.taxonomies.genre?.[0]?.taxonomy).toBe('genre');
    });
  });

  describe('Custom relation registration', () => {
    it('allows runtime registration of custom relations', async () => {
      // Define a simple custom relation that extracts from a hypothetical _embedded field
      registerTestRelation({
        name: 'testCustomRelation',
        embeddedKey: 'test:custom',
        extractEmbedded: (data) => {
          if (!Array.isArray(data)) return null;
          return data.map((item: unknown) => {
            if (typeof item === 'object' && item !== null) {
              return { id: (item as { id?: number }).id ?? 0, name: String((item as { name?: string }).name ?? 'unknown') };
            }
            return null;
          }).filter((item): item is { id: number; name: string } => item !== null);
        },
      });

      // Verify the relation is registered
      expect(customRelationRegistry.has('testCustomRelation')).toBe(true);
    });

    it('unregisters custom relations cleanly', () => {
      // Register and immediately unregister
      const testConfig: CustomRelationConfig<{ test: string }> = {
        name: 'tempRelation',
        embeddedKey: 'test:temp',
        extractEmbedded: () => null,
      };
      
      customRelationRegistry.register(testConfig);
      expect(customRelationRegistry.has('tempRelation')).toBe(true);
      
      customRelationRegistry.unregister('tempRelation');
      expect(customRelationRegistry.has('tempRelation')).toBe(false);
    });

    it('handles missing custom relations gracefully', async () => {
      // Request a non-existent custom relation
      const post = await authClient
        .post('test-post-001')
        .with('nonExistentCustomRelation' as any)
        .get();

      // Should return the post but the custom relation won't be in related
      expect(post.slug).toBe('test-post-001');
      // The non-existent relation should be undefined
      expect(post.related.nonExistentCustomRelation).toBeUndefined();
    });
  });

  describe('Custom relation with fallback resolver', () => {
    it('uses fallback resolver when embedded data is unavailable', async () => {
      // Create a custom relation with a fallback that reads from post meta
      registerTestRelation({
        name: 'testFallbackRelation',
        embeddedKey: 'test:fallback',
        extractEmbedded: () => null, // Always returns null to force fallback
        fallbackResolver: {
          resolve: async (_client, post) => {
            // Simulate reading from meta field
            const meta = (post as { meta?: Record<string, unknown> }).meta;
            return {
              fallbackValue: meta?.test_field ?? 'default',
              postId: post.id,
            };
          },
        },
      });

      const post = await authClient
        .post('test-post-001')
        .with('testFallbackRelation')
        .get();

      // The fallback should have been invoked
      expect(post.related.testFallbackRelation).toBeDefined();
      expect((post.related.testFallbackRelation as { postId: number }).postId).toBe(post.id);
    });
  });

  describe('Custom relation with required fields', () => {
    it('reports required fields for custom relations', async () => {
      registerTestRelation({
        name: 'testFieldsRelation',
        embeddedKey: 'test:fields',
        extractEmbedded: (data) => data,
        requiredFields: ['meta', 'acf'],
      });

      const builder = authClient.post('test-post-001').with('testFieldsRelation');
      const requiredFields = builder.getRequiredFields();

      // Should include the custom relation's required fields
      expect(requiredFields).toContain('meta');
      expect(requiredFields).toContain('acf');
    });
  });

  describe('Mixed built-in and custom relations', () => {
    it('correctly hydrates multiple relation types simultaneously', async () => {
      const post = await authClient
        .post('test-post-003')
        .with(
          'author',
          'categories',
          'tags',
          'featuredMedia',
          acfRelationshipRelationName,
          acfPostObjectRelationName,
        )
        .get();

      // All built-in relations should be present
      expect(post.related.author).toBeDefined();
      expect(Array.isArray(post.related.categories)).toBe(true);
      expect(Array.isArray(post.related.tags)).toBe(true);
      expect(post.related.featuredMedia !== undefined).toBe(true);

      // All ACF relations should be present
      expect(Array.isArray(post.related[acfRelationshipRelationName])).toBe(true);
      expect(post.related[acfPostObjectRelationName] !== undefined).toBe(true);
    });

    it('handles posts with partial ACF data', async () => {
      // test-post-004 may have different ACF setup
      const post = await authClient
        .post('test-post-004')
        .with(acfRelationshipRelationName, acfPostObjectRelationName)
        .get();

      // Should handle gracefully even if some ACF fields are empty
      expect(post.slug).toBe('test-post-004');
      expect(Array.isArray(post.related[acfRelationshipRelationName]) || post.related[acfRelationshipRelationName] === null).toBe(true);
      expect(post.related[acfPostObjectRelationName] === null || typeof post.related[acfPostObjectRelationName] === 'object').toBe(true);
    });
  });

  describe('getRequiredFields method', () => {
    it('returns required fields for built-in relations only', () => {
      const builder = authClient.post('test-post-001').with('author', 'categories');
      const fields = builder.getRequiredFields();

      expect(fields).toContain('author');
      expect(fields).toContain('categories');
    });

    it('returns required fields including custom relations', () => {
      registerTestRelation({
        name: 'testReqFields',
        embeddedKey: 'test:req',
        extractEmbedded: () => null,
        requiredFields: ['custom_field_1', 'custom_field_2'],
      });

      const builder = authClient
        .post('test-post-001')
        .with('author', 'testReqFields');
      
      const fields = builder.getRequiredFields();

      expect(fields).toContain('author');
      expect(fields).toContain('custom_field_1');
      expect(fields).toContain('custom_field_2');
    });

    it('deduplicates required fields', () => {
      const builder = authClient
        .post('test-post-001')
        .with('categories', 'terms'); // terms requires categories too
      
      const fields = builder.getRequiredFields();
      
      // categories should only appear once
      const categoriesCount = fields.filter(f => f === 'categories').length;
      expect(categoriesCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('handles empty custom relations gracefully', async () => {
      registerTestRelation({
        name: 'testEmptyRelation',
        embeddedKey: 'test:empty',
        extractEmbedded: () => [], // Returns empty array
      });

      const post = await authClient
        .post('test-post-001')
        .with('testEmptyRelation')
        .get();

      // When embedded data is not present and no fallback, returns null
      expect(post.related.testEmptyRelation).toBeNull();
    });

    it('handles null custom relations gracefully', async () => {
      registerTestRelation({
        name: 'testNullRelation',
        embeddedKey: 'test:null',
        extractEmbedded: () => null,
      });

      const post = await authClient
        .post('test-post-001')
        .with('testNullRelation')
        .get();

      expect(post.related.testNullRelation).toBeNull();
    });

    it('handles fallback resolver errors gracefully', async () => {
      registerTestRelation({
        name: 'testErrorRelation',
        embeddedKey: 'test:error',
        extractEmbedded: () => null,
        fallbackResolver: {
          resolve: async () => {
            throw new Error('Fallback failed');
          },
        },
      });

      const post = await authClient
        .post('test-post-001')
        .with('testErrorRelation')
        .get();

      // Should return null when fallback fails
      expect(post.related.testErrorRelation).toBeNull();
    });
  });

  describe('Public client behavior', () => {
    it('handles ACF relations for public client', async () => {
      // Public client may have limited access
      const post = await publicClient
        .post('test-post-001')
        .with(acfRelationshipRelationName)
        .get();

      expect(post.slug).toBe('test-post-001');
      // Result may vary based on public API access to ACF
      expect(Array.isArray(post.related[acfRelationshipRelationName]) || post.related[acfRelationshipRelationName] === null).toBe(true);
    });
  });
});
