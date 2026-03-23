import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contentWordPressSchema, type WordPressClient } from 'fluent-wp-client';
import { createAuthClient } from '../helpers/wp-client';

/**
 * Integration coverage for generic content resource relation hydration.
 */
describe('Client: custom content relation hydration', () => {
  let authClient: WordPressClient;
  const createdGenreIds: number[] = [];
  const createdBookIds: number[] = [];

  beforeAll(() => {
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdBookIds) {
      await authClient.deleteContent('books', id, { force: true }).catch(() => undefined);
    }

    for (const id of createdGenreIds) {
      await authClient.deleteTerm('genre', id, { force: true }).catch(() => undefined);
    }
  });

  /**
   * Creates one draft book assigned to one custom taxonomy term.
   */
  async function createBookWithGenre(): Promise<{ id: number; slug: string; genreId: number }> {
    const suffix = String(createdGenreIds.length + 1);

    const genre = await authClient.createTerm('genre', {
      name: `client-content-relations-genre-${suffix}`,
      slug: `client-content-relations-genre-${suffix}`,
    });
    createdGenreIds.push(genre.id);

    const book = await authClient.content('books', contentWordPressSchema).create({
      title: `Client Content Relation Book ${suffix}`,
      status: 'draft',
      genre: [genre.id],
    });
    createdBookIds.push(book.id);

    const readBack = await authClient.content('books', contentWordPressSchema).getById(book.id);

    return {
      id: readBack.id,
      slug: readBack.slug,
      genreId: genre.id,
    };
  }

  it('hydrates custom taxonomy terms through content().item().with().get()', async () => {
    const created = await createBookWithGenre();

    const hydrated = await authClient
      .content('books', contentWordPressSchema)
      .item(created.id)
      .with('terms')
      .get();

    expect(hydrated.id).toBe(created.id);
    expect(hydrated.related.terms.taxonomies.genre?.[0]?.id).toBe(created.genreId);
    expect(hydrated.related.terms.taxonomies.genre?.[0]?.taxonomy).toBe('genre');
  });

  it('hydrates custom taxonomy terms through content().getWithRelations()', async () => {
    const created = await createBookWithGenre();

    const hydrated = await authClient
      .content('books', contentWordPressSchema)
      .getWithRelations(created.id, 'terms');

    expect(hydrated.related.terms.taxonomies.genre).toBeDefined();
    expect(hydrated.related.terms.taxonomies.genre?.length).toBeGreaterThan(0);
    expect(hydrated.related.terms.taxonomies.genre?.[0]?.taxonomy).toBe('genre');
    expect(hydrated.related.terms.taxonomies.genre?.[0]?.id).toBe(created.genreId);
  });
});
