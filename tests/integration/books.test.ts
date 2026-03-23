import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient, contentWordPressSchema } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Seed data: 10 books registered through the `book` custom post type.
 *
 * This suite covers the generic content-resource client APIs that power custom
 * post type support.
 */
describe('Client: Books', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  const createdBookIds: number[] = [];

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdBookIds) {
      await authClient.deleteContent('books', id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('getContentCollection returns seeded books', async () => {
      const books = await publicClient.getContentCollection('books');

      expect(Array.isArray(books)).toBe(true);
      expect(books).toHaveLength(10);
      expect(books[0]?.type).toBe('book');
    });

    it('getContentBySlug fetches a known seeded book', async () => {
      const book = await publicClient.getContentBySlug('books', 'test-book-001');

      expect(book).toBeDefined();
      expect(book?.slug).toBe('test-book-001');
      expect(book?.type).toBe('book');
    });

    it('getContentCollection supports the search parameter', async () => {
      const books = await publicClient.getContentCollection('books', { search: 'Test Book 001' });

      expect(Array.isArray(books)).toBe(true);
      expect(books.length).toBeGreaterThan(0);
      expect(books[0]?.slug).toBe('test-book-001');
    });

    it('getAllContentCollection supports the search parameter', async () => {
      const books = await publicClient.getAllContentCollection('books', { search: 'Test Book' });

      expect(Array.isArray(books)).toBe(true);
      expect(books.length).toBeGreaterThan(0);
      for (const book of books) {
        expect(book?.slug).toMatch(/^test-book-/);
      }
    });

    it('content() list() supports the search parameter', async () => {
      const booksClient = publicClient.content('books', contentWordPressSchema);
      const results = await booksClient.list({ search: 'Test Book 001' });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.slug).toBe('test-book-001');
    });

    it('getContentCollection supports include arrays on custom post type endpoints', async () => {
      const first = await publicClient.getContentBySlug('books', 'test-book-001');
      const second = await publicClient.getContentBySlug('books', 'test-book-002');

      expect(first).toBeDefined();
      expect(second).toBeDefined();

      const books = await publicClient.getContentCollection('books', {
        include: [first!.id, second!.id],
      });

      expect(books.map((book) => book.id).sort((a, b) => a - b)).toEqual(
        [first!.id, second!.id].sort((a, b) => a - b),
      );
    });

    it('content() list() forwards custom registered collection filters for custom post types', async () => {
      const booksClient = publicClient.content('books', contentWordPressSchema);
      const results = await booksClient.list({ titleSearch: 'Test Book 001' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.slug).toBe('test-book-001');
    });

    it('content() listAll() supports the search parameter', async () => {
      const booksClient = publicClient.content('books', contentWordPressSchema);
      const results = await booksClient.listAll({ search: 'Test Book' });

      expect(results.length).toBeGreaterThan(0);
      for (const book of results) {
        expect(book?.slug).toMatch(/^test-book-/);
      }
    });

    it('content() listAll returns every seeded book', async () => {
      const books = publicClient.content('books', contentWordPressSchema);
      const all = await books.listAll();

      expect(all).toHaveLength(10);
    });

    it('content() listPaginated returns pagination metadata', async () => {
      const books = publicClient.content('books', contentWordPressSchema);
      const result = await books.listPaginated({ perPage: 5, page: 1 });

      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes custom post types with generic content()', async () => {
      const books = authClient.content('books', contentWordPressSchema);

      const created = await books.create({
        title: 'Client CRUD: Book create',
        status: 'draft',
      });

      createdBookIds.push(created.id);

      expect(created.type).toBe('book');

      const updated = await books.update(created.id, {
        title: 'Client CRUD: Book update',
        status: 'publish',
      });

      expect(updated.title.rendered).toBe('Client CRUD: Book update');
      expect(updated.status).toBe('publish');

      const deleted = await books.delete(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });

    it('throws for unauthenticated custom post type creation', async () => {
      const publicBooks = publicClient.content('books', contentWordPressSchema);

      await expect(
        publicBooks.create({
          title: 'Client CRUD: Public book create',
          status: 'draft',
        }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });

    it('throws for a non-existent custom post type entry on update', async () => {
      const books = authClient.content('books', contentWordPressSchema);

      await expect(
        books.update(999999, { title: 'Ghost Book' }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });
  });
});
