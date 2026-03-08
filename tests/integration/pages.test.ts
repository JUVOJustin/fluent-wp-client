import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient, pageSchema, type WordPressStandardSchema } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Seed data: 10 pages (About, Contact, Services, FAQ, Team, Blog, Portfolio,
 * Testimonials, Privacy Policy, Terms of Service).
 */
describe('Client: Pages', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  const createdPageIds: number[] = [];

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdPageIds) {
      await authClient.deletePage(id, { force: true }).catch(() => undefined);
    }
  });

  describe('reads', () => {
    it('getPages returns an array of pages', async () => {
      const pages = await publicClient.getPages();

      expect(Array.isArray(pages)).toBe(true);
      expect(pages.length).toBeGreaterThan(0);
    });

    it('every page has required fields', async () => {
      const pages = await publicClient.getPages();

      for (const page of pages) {
        expect(page).toHaveProperty('id');
        expect(page).toHaveProperty('slug');
        expect(page).toHaveProperty('title.rendered');
        expect(page).toHaveProperty('content.rendered');
        expect(page).toHaveProperty('date');
        expect(page).toHaveProperty('status');
        expect(page).toHaveProperty('parent');
        expect(page).toHaveProperty('menu_order');
      }
    });

    it('getPageBySlug fetches a known seed page', async () => {
      const page = await publicClient.getPageBySlug('about');

      expect(page).toBeDefined();
      expect(page!.slug).toBe('about');
      expect(page!.title.rendered).toBe('About');
    });

    it('getPageBySlug returns undefined for non-existent slug', async () => {
      const page = await publicClient.getPageBySlug('non-existent-page-slug-999');

      expect(page).toBeUndefined();
    });

    it('getAllPages returns all 10 seed pages', async () => {
      const all = await publicClient.getAllPages();

      expect(all).toHaveLength(10);
    });

    it('getPagesPaginated returns pagination metadata', async () => {
      const result = await publicClient.getPagesPaginated({ perPage: 5, page: 1 });

      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(5);
    });
  });

  describe('crud', () => {
    it('creates, updates, and deletes pages', async () => {
      const created = await authClient.createPage(
        {
          title: 'Client CRUD: Page create',
          status: 'draft',
          menu_order: 7,
        },
        pageSchema,
      );

      createdPageIds.push(created.id);

      expect(created.type).toBe('page');
      expect(created.menu_order).toBe(7);

      const updated = await authClient.updatePage(
        created.id,
        {
          title: 'Client CRUD: Page update',
          menu_order: 12,
        },
        pageSchema,
      );

      expect(updated.title.rendered).toBe('Client CRUD: Page update');
      expect(updated.menu_order).toBe(12);

      const deleted = await authClient.deletePage(created.id, { force: true });
      expect(deleted.deleted).toBe(true);
    });

    it('creates one hierarchical page with parent and content fields', async () => {
      const parent = await authClient.createPage(
        {
          title: 'Client CRUD: Page parent',
          status: 'draft',
        },
        pageSchema,
      );

      createdPageIds.push(parent.id);

      const child = await authClient.createPage(
        {
          title: 'Client CRUD: Page child',
          content: '<p>Child page content.</p>',
          excerpt: 'Child page excerpt',
          parent: parent.id,
          menu_order: 5,
          status: 'draft',
        },
        pageSchema,
      );

      createdPageIds.push(child.id);

      expect(child.parent).toBe(parent.id);
      expect(child.menu_order).toBe(5);
      expect(child.content.rendered).toContain('Child page content.');
      expect(child.excerpt.rendered).toContain('Child page excerpt');
    });

    it('updates page-specific hierarchical fields', async () => {
      const parent = await authClient.createPage(
        {
          title: 'Client CRUD: Page update parent',
          status: 'draft',
        },
        pageSchema,
      );

      createdPageIds.push(parent.id);

      const child = await authClient.createPage(
        {
          title: 'Client CRUD: Page update child',
          status: 'draft',
        },
        pageSchema,
      );

      createdPageIds.push(child.id);

      const updated = await authClient.updatePage(
        child.id,
        {
          parent: parent.id,
          menu_order: 42,
        },
        pageSchema,
      );

      expect(updated.parent).toBe(parent.id);
      expect(updated.menu_order).toBe(42);
    });

    it('throws for unauthenticated page creation', async () => {
      await expect(
        publicClient.createPage({
          title: 'Client CRUD: Public page create',
          status: 'draft',
        }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
      });
    });

    it('throws for a non-existent page on update', async () => {
      await expect(
        authClient.updatePage(999999, { title: 'Ghost Page' }, pageSchema),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });

    it('accepts custom Standard Schema validators for mutation responses', async () => {
      const minimalPageSchema: WordPressStandardSchema<{ id: number; slug: string; status: string }> = {
        '~standard': {
          version: 1,
          vendor: 'integration-test',
          validate(value) {
            if (typeof value !== 'object' || value === null) {
              return {
                issues: [{ message: 'Expected object response.' }],
              };
            }

            const record = value as Record<string, unknown>;

            if (typeof record.id !== 'number') {
              return {
                issues: [{ message: 'Expected numeric id.' }],
              };
            }

            if (typeof record.slug !== 'string') {
              return {
                issues: [{ message: 'Expected string slug.' }],
              };
            }

            if (typeof record.status !== 'string') {
              return {
                issues: [{ message: 'Expected string status.' }],
              };
            }

            return {
              value: {
                id: record.id,
                slug: record.slug,
                status: record.status,
              },
            };
          },
        },
      };

      const created = await authClient.createPage(
        {
          title: 'Client CRUD: Standard Schema create',
          status: 'draft',
        },
        minimalPageSchema,
      );

      createdPageIds.push(created.id);

      expect(created.id).toBeGreaterThan(0);
      expect(typeof created.slug).toBe('string');
      expect(created.status).toBe('draft');
    });
  });
});
