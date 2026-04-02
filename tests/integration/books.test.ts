import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
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
      await authClient.content('books').delete(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('content() list() returns seeded books', async () => {
      const books = await publicClient.content('books').list();

      expect(Array.isArray(books)).toBe(true);
      expect(books).toHaveLength(10);
      expect(books[0]?.type).toBe('book');
    });

    it('content() list() omits embedded data by default', async () => {
      const books = await publicClient.content('books').list({ perPage: 5 });

      expect(books).toHaveLength(5);

      for (const book of books) {
        expect(book).not.toHaveProperty('_embedded');
      }
    });

    it('content() list() accepts opt-in embedded data filters', async () => {
      const books = await publicClient.content('books').list({ perPage: 5, embed: true });

      expect(books).toHaveLength(5);
    });

    it('content() item fetches a known seeded book', async () => {
      const book = await publicClient.content('books').item('test-book-001');

      expect(book).toBeDefined();
      expect(book?.slug).toBe('test-book-001');
      expect(book?.type).toBe('book');
    });

    it('content() list() supports the search parameter', async () => {
      const books = await publicClient.content('books').list({ search: 'Test Book 001' });

      expect(Array.isArray(books)).toBe(true);
      expect(books.length).toBeGreaterThan(0);
      expect(books[0]?.slug).toBe('test-book-001');
    });

    it('content() listAll() supports the search parameter', async () => {
      const books = await publicClient.content('books').listAll({ search: 'Test Book' });

      expect(Array.isArray(books)).toBe(true);
      expect(books.length).toBeGreaterThan(0);
      for (const book of books) {
        expect(book?.slug).toMatch(/^test-book-/);
      }
    });

    it('content() list() supports the search parameter with validation', async () => {
      const booksClient = publicClient.content('books');
      const results = await booksClient.list({ search: 'Test Book 001' });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.slug).toBe('test-book-001');
    });

    it('content() list() supports include arrays on custom post type endpoints', async () => {
      const first = await publicClient.content('books').item('test-book-001');
      const second = await publicClient.content('books').item('test-book-002');

      expect(first).toBeDefined();
      expect(second).toBeDefined();

      const books = await publicClient.content('books').list({
        include: [first!.id, second!.id],
      });

      expect(books.map((book) => book.id).sort((a, b) => a - b)).toEqual(
        [first!.id, second!.id].sort((a, b) => a - b),
      );
    });

    it('content() list() forwards custom registered collection filters for custom post types', async () => {
      const booksClient = publicClient.content('books');
      const results = await booksClient.list({ titleSearch: 'Test Book 001' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.slug).toBe('test-book-001');
    });

    it('content() listAll() supports the search parameter', async () => {
      const booksClient = publicClient.content('books');
      const results = await booksClient.listAll({ search: 'Test Book' });

      expect(results.length).toBeGreaterThan(0);
      for (const book of results) {
        expect(book?.slug).toMatch(/^test-book-/);
      }
    });

    it('content() listAll returns every seeded book', async () => {
      const books = publicClient.content('books');
      const all = await books.listAll();

      expect(all).toHaveLength(10);
    });

    it('content() listPaginated returns pagination metadata', async () => {
      const books = publicClient.content('books');
      const result = await books.listPaginated({ perPage: 5, page: 1 });

      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(1);
    });

    it('content() item validates one seeded book with the strict content schema', async () => {
      const books = publicClient.content('books');
      const book = await books.item('test-book-001');

      expect(book).toBeDefined();
      expect(book?.slug).toBe('test-book-001');
      expect(book?.title.rendered).toBe('Test Book 001');
      expect(book?.content.rendered).toContain('Content for test book 001');
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes custom post types with generic content()', async () => {
      const books = authClient.content('books');

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
      const publicBooks = publicClient.content('books');

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
      const books = authClient.content('books');

      await expect(
        books.update(999999, { title: 'Ghost Book' }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });
  });
});
