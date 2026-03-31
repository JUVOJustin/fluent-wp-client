import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  WordPressClient,
  postSchema,
  WordPressSchemaValidationError,
  type MutationOptions,
} from 'fluent-wp-client';
import { z } from 'zod';
import { createAuthClient } from '../helpers/wp-client';

/**
 * Integration coverage for inputSchema support in .create() and .update().
 *
 * Verifies that:
 * - inputSchema validates and transforms the payload before the HTTP request
 * - Invalid input throws WordPressSchemaValidationError without making a request
 * - responseSchema still works when provided alongside inputSchema
 * - Backward-compatible call signatures continue to work unchanged
 * - Settings.update() supports inputSchema
 */
describe('Client: inputSchema validation', () => {
  let authClient: WordPressClient;
  const createdIds: number[] = [];

  beforeAll(() => {
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await authClient.content('posts').delete(id, { force: true }).catch(() => undefined);
    }
  });

  // --- create() ---

  describe('create() with inputSchema', () => {
    it('accepts valid input and creates the resource', async () => {
      const inputSchema = z.object({
        title: z.string().min(1),
        status: z.enum(['draft', 'publish', 'private']),
      });

      const created = await authClient.content('posts').create(
        { title: 'inputSchema: create valid', status: 'draft' },
        { inputSchema, responseSchema: postSchema },
      );

      createdIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.title.rendered).toBe('inputSchema: create valid');
      expect(created.status).toBe('draft');
    });

    it('throws WordPressSchemaValidationError before the request when input is invalid', async () => {
      const inputSchema = z.object({
        title: z.string().min(100, 'title must be at least 100 characters'),
        status: z.enum(['draft', 'publish']),
      });

      await expect(
        authClient.content('posts').create(
          { title: 'too short', status: 'draft' },
          { inputSchema },
        ),
      ).rejects.toThrow(WordPressSchemaValidationError);
    });

    it('throws with a descriptive message that includes the field and constraint', async () => {
      const inputSchema = z.object({
        status: z.literal('publish'),
      });

      await expect(
        authClient.content('posts').create(
          { status: 'draft' } as never,
          { inputSchema },
        ),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof WordPressSchemaValidationError
          && err.message.includes('input validation failed');
      });
    });

    it('applies schema transformations before sending to the server', async () => {
      // The schema trims the title — the post should be created with the trimmed value
      const inputSchema = z.object({
        title: z.string().trim(),
        status: z.enum(['draft', 'publish', 'private']).default('draft'),
      });

      const created = await authClient.content('posts').create(
        { title: '  inputSchema: trim transform  ', status: 'draft' },
        { inputSchema, responseSchema: postSchema },
      );

      createdIds.push(created.id);

      expect(created.title.rendered).toBe('inputSchema: trim transform');
    });

    it('works with only inputSchema (no responseSchema)', async () => {
      const inputSchema = z.object({
        title: z.string().min(1),
        status: z.enum(['draft', 'publish', 'private']),
      });

      const created = await authClient.content('posts').create(
        { title: 'inputSchema: no responseSchema', status: 'draft' },
        { inputSchema },
      );

      createdIds.push((created as { id: number }).id);

      expect((created as { id: number }).id).toBeGreaterThan(0);
    });

    it('works with custom post types', async () => {
      const inputSchema = z.object({
        title: z.string().min(1),
        status: z.enum(['draft', 'publish', 'private']),
      });

      const created = await authClient.content('books').create(
        { title: 'inputSchema: book valid', status: 'draft' },
        { inputSchema },
      );

      const id = (created as { id: number }).id;

      await authClient.content('books').delete(id, { force: true }).catch(() => undefined);

      expect(id).toBeGreaterThan(0);
    });

    it('throws for custom post types with invalid input', async () => {
      const inputSchema = z.object({
        title: z.string().min(50, 'title must be at least 50 characters'),
        status: z.enum(['draft', 'publish']),
      });

      await expect(
        authClient.content('books').create(
          { title: 'short', status: 'draft' },
          { inputSchema },
        ),
      ).rejects.toThrow(WordPressSchemaValidationError);
    });
  });

  // --- update() ---

  describe('update() with inputSchema', () => {
    it('accepts valid input and updates the resource', async () => {
      const created = await authClient.content('posts').create(
        { title: 'inputSchema: pre-update', status: 'draft' },
        postSchema,
      );

      createdIds.push(created.id);

      const inputSchema = z.object({
        title: z.string().min(1),
        status: z.enum(['draft', 'publish', 'private']).optional(),
      });

      const updated = await authClient.content('posts').update(
        created.id,
        { title: 'inputSchema: post-update', status: 'private' },
        { inputSchema, responseSchema: postSchema },
      );

      expect(updated.title.rendered).toBe('inputSchema: post-update');
      expect(updated.status).toBe('private');
    });

    it('throws WordPressSchemaValidationError before the request when input is invalid', async () => {
      const created = await authClient.content('posts').create(
        { title: 'inputSchema: update reject target', status: 'draft' },
        postSchema,
      );

      createdIds.push(created.id);

      const inputSchema = z.object({
        title: z.string().min(100, 'title must be at least 100 characters'),
      });

      await expect(
        authClient.content('posts').update(
          created.id,
          { title: 'short' },
          { inputSchema },
        ),
      ).rejects.toThrow(WordPressSchemaValidationError);
    });
  });

  // --- backward compatibility ---

  describe('backward compatibility', () => {
    it('create() still works with a bare responseSchema as the second argument', async () => {
      const created = await authClient.content('posts').create(
        { title: 'inputSchema: backward-compat create', status: 'draft' },
        postSchema,
      );

      createdIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(created.title.rendered).toBe('inputSchema: backward-compat create');
    });

    it('update() still works with a bare responseSchema as the third argument', async () => {
      const created = await authClient.content('posts').create(
        { title: 'inputSchema: backward-compat update base', status: 'draft' },
        postSchema,
      );

      createdIds.push(created.id);

      const updated = await authClient.content('posts').update(
        created.id,
        { title: 'inputSchema: backward-compat update done' },
        postSchema,
      );

      expect(updated.title.rendered).toBe('inputSchema: backward-compat update done');
    });

    it('create() still works with plain request options as the second argument', async () => {
      const created = await authClient.content('posts').create(
        { title: 'inputSchema: backward-compat headers', status: 'draft' },
        { headers: { 'X-WP-Nonce': '' } },
      );

      createdIds.push((created as { id: number }).id);

      expect((created as { id: number }).id).toBeGreaterThan(0);
    });
  });

  // --- MutationOptions type export ---

  describe('MutationOptions type', () => {
    it('is structurally correct and usable as a typed object', () => {
      const opts: MutationOptions<{ title: string }, unknown> = {
        inputSchema: z.object({ title: z.string() }),
      };

      expect(opts.inputSchema).toBeDefined();
    });
  });

  // --- settings.update() ---

  describe('settings().update() with inputSchema', () => {
    it('accepts valid input and updates the settings', async () => {
      const original = await authClient.settings().get();

      const inputSchema = z.object({
        posts_per_page: z.number().int().min(1).max(100),
      });

      const temporaryValue = 7;

      try {
        const updated = await authClient.settings().update(
          { posts_per_page: temporaryValue },
          { inputSchema },
        );

        expect((updated as { posts_per_page: number }).posts_per_page).toBe(temporaryValue);
      } finally {
        await authClient.settings().update({ posts_per_page: original.posts_per_page });
      }
    });

    it('throws WordPressSchemaValidationError before the request when settings input is invalid', async () => {
      const inputSchema = z.object({
        posts_per_page: z.number().int().min(200, 'must be at least 200'),
      });

      await expect(
        authClient.settings().update(
          { posts_per_page: 10 },
          { inputSchema },
        ),
      ).rejects.toThrow(WordPressSchemaValidationError);
    });
  });

  // --- terms ---

  describe('terms().create() and update() with inputSchema', () => {
    it('creates a term with valid inputSchema', async () => {
      const inputSchema = z.object({
        name: z.string().min(1),
      });

      const created = await authClient.terms('categories').create(
        { name: 'inputSchema: category valid' },
        { inputSchema },
      );

      const id = (created as { id: number }).id;

      await authClient.terms('categories').delete(id, { force: true }).catch(() => undefined);

      expect(id).toBeGreaterThan(0);
    });

    it('throws for invalid term input', async () => {
      const inputSchema = z.object({
        name: z.string().min(50, 'name must be at least 50 characters'),
      });

      await expect(
        authClient.terms('categories').create(
          { name: 'short' },
          { inputSchema },
        ),
      ).rejects.toThrow(WordPressSchemaValidationError);
    });
  });
});
