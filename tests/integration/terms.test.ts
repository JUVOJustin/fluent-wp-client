import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for generic taxonomy-term helpers and custom taxonomies.
 */
describe('Client: Terms', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let seedGenreId = 0;
  const seedGenreSlug = 'client-terms-seed';
  const createdGenreIds: number[] = [];

  beforeAll(async () => {
    publicClient = createPublicClient();
    authClient = createAuthClient();

    const existing = await authClient.getTermBySlug('genre', seedGenreSlug);

    if (existing) {
      await authClient.deleteTerm('genre', existing.id, { force: true });
    }

    const seededGenre = await authClient.createTerm('genre', {
      name: 'Client Terms Seed',
      slug: seedGenreSlug,
      description: 'Seed genre for generic term integration tests.',
    });

    seedGenreId = seededGenre.id;
    createdGenreIds.push(seededGenre.id);
  });

  afterAll(async () => {
    for (const id of createdGenreIds) {
      await authClient.deleteTerm('genre', id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('getTermCollection returns custom taxonomy terms', async () => {
      const genres = await publicClient.getTermCollection('genre');

      expect(Array.isArray(genres)).toBe(true);
      expect(genres.some((genre) => genre.id === seedGenreId)).toBe(true);
    });

    it('getTerm fetches a custom taxonomy term by ID', async () => {
      const genre = await publicClient.getTerm('genre', seedGenreId);

      expect(genre.id).toBe(seedGenreId);
      expect(genre.slug).toBe(seedGenreSlug);
      expect(genre.taxonomy).toBe('genre');
    });

    it('getTermBySlug fetches a custom taxonomy term by slug', async () => {
      const genre = await publicClient.getTermBySlug('genre', seedGenreSlug);

      expect(genre).toBeDefined();
      expect(genre?.id).toBe(seedGenreId);
      expect(genre?.taxonomy).toBe('genre');
    });

    it('getAllTermCollection returns custom taxonomy terms across pages', async () => {
      const genres = await publicClient.getAllTermCollection('genre');

      expect(genres.some((genre) => genre.id === seedGenreId)).toBe(true);
    });

    it('getTermCollectionPaginated returns pagination metadata', async () => {
      const result = await publicClient.getTermCollectionPaginated('genre', { perPage: 1, page: 1 });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(1);
    });

    it('terms() exposes fluent reads for custom taxonomies', async () => {
      const genres = publicClient.terms('genre');
      const bySlug = await genres.getBySlug(seedGenreSlug);
      const all = await genres.listAll();

      expect(bySlug?.id).toBe(seedGenreId);
      expect(all.some((genre) => genre.id === seedGenreId)).toBe(true);
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes custom taxonomy terms with generic terms()', async () => {
      const genres = authClient.terms('genre');

      const created = await genres.create({
        name: 'Client CRUD Genre',
        description: 'Custom taxonomy term created by integration tests.',
      });

      createdGenreIds.push(created.id);

      expect(created.taxonomy).toBe('genre');
      expect(created.name).toBe('Client CRUD Genre');

      const updated = await genres.update(created.id, {
        name: 'Client CRUD Genre Updated',
        slug: 'client-crud-genre-updated',
      });

      expect(updated.taxonomy).toBe('genre');
      expect(updated.name).toBe('Client CRUD Genre Updated');
      expect(updated.slug).toBe('client-crud-genre-updated');

      const bySlug = await genres.getBySlug('client-crud-genre-updated');
      expect(bySlug?.id).toBe(created.id);

      const deleted = await genres.delete(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });

    it('throws for unauthenticated custom taxonomy term creation', async () => {
      const publicGenres = publicClient.terms('genre');

      await expect(
        publicGenres.create({
          name: 'Client CRUD Public Genre',
        }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });

    it('throws for a non-existent custom taxonomy term on update', async () => {
      const genres = authClient.terms('genre');

      await expect(
        genres.update(999999, { name: 'Ghost Genre' }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });
  });
});
