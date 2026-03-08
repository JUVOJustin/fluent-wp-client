import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  WordPressClient,
  contentWordPressSchema,
  pageSchema,
  type WordPressStandardSchema,
} from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for resource CRUD in the standalone client package.
 */
describe('Client: CRUD operations', () => {
  let client: WordPressClient;
  let publicClient: WordPressClient;
  const createdPages: number[] = [];
  const createdBooks: number[] = [];
  const createdCategories: number[] = [];
  const createdTags: number[] = [];
  const createdComments: number[] = [];

  beforeAll(() => {
    client = createAuthClient();
    publicClient = createPublicClient();
  });

  afterAll(async () => {
    for (const id of createdComments) {
      await client.deleteComment(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdPages) {
      await client.deletePage(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdBooks) {
      await client.deleteContent('books', id, { force: true }).catch(() => undefined);
    }

    for (const id of createdCategories) {
      await client.deleteCategory(id, { force: true }).catch(() => undefined);
    }

    for (const id of createdTags) {
      await client.deleteTag(id, { force: true }).catch(() => undefined);
    }
  });

  it('creates, updates, and deletes pages', async () => {
    const created = await client.createPage(
      {
        title: 'Client CRUD: Page create',
        status: 'draft',
        menu_order: 7,
      },
      pageSchema,
    );

    createdPages.push(created.id);

    expect(created.type).toBe('page');
    expect(created.menu_order).toBe(7);

    const updated = await client.updatePage(
      created.id,
      {
        title: 'Client CRUD: Page update',
        menu_order: 12,
      },
      pageSchema,
    );

    expect(updated.title.rendered).toBe('Client CRUD: Page update');
    expect(updated.menu_order).toBe(12);

    const deleted = await client.deletePage(created.id, { force: true });
    expect(deleted.deleted).toBe(true);
  });

  it('creates one hierarchical page with parent and content fields', async () => {
    const parent = await client.createPage(
      {
        title: 'Client CRUD: Page parent',
        status: 'draft',
      },
      pageSchema,
    );

    createdPages.push(parent.id);

    const child = await client.createPage(
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

    createdPages.push(child.id);

    expect(child.parent).toBe(parent.id);
    expect(child.menu_order).toBe(5);
    expect(child.content.rendered).toContain('Child page content.');
    expect(child.excerpt.rendered).toContain('Child page excerpt');
  });

  it('updates page-specific hierarchical fields', async () => {
    const parent = await client.createPage(
      {
        title: 'Client CRUD: Page update parent',
        status: 'draft',
      },
      pageSchema,
    );

    createdPages.push(parent.id);

    const child = await client.createPage(
      {
        title: 'Client CRUD: Page update child',
        status: 'draft',
      },
      pageSchema,
    );

    createdPages.push(child.id);

    const updated = await client.updatePage(
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
      client.updatePage(999999, { title: 'Ghost Page' }, pageSchema),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
      status: 404,
    });
  });

  it('creates, updates, and deletes custom post types with generic content()', async () => {
    const books = client.content('books', contentWordPressSchema);

    const created = await books.create({
      title: 'Client CRUD: Book create',
      status: 'draft',
    });

    createdBooks.push(created.id);

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
    const books = client.content('books', contentWordPressSchema);

    await expect(
      books.update(999999, { title: 'Ghost Book' }),
    ).rejects.toMatchObject({
      name: 'WordPressApiError',
      status: 404,
    });
  });

  it('creates, updates, and deletes categories and tags', async () => {
    const category = await client.createCategory({
      name: 'Client CRUD Category',
      description: 'Category created by integration tests.',
    });

    createdCategories.push(category.id);
    expect(category.name).toBe('Client CRUD Category');

    const updatedCategory = await client.updateCategory(category.id, {
      name: 'Client CRUD Category Updated',
    });

    expect(updatedCategory.name).toBe('Client CRUD Category Updated');

    const tag = await client.createTag({
      name: 'client-crud-tag',
      description: 'Tag created by integration tests.',
    });

    createdTags.push(tag.id);
    expect(tag.name).toBe('client-crud-tag');

    const updatedTag = await client.updateTag(tag.id, {
      name: 'client-crud-tag-updated',
    });

    expect(updatedTag.name).toBe('client-crud-tag-updated');

    const deletedCategory = await client.deleteCategory(category.id, { force: true });
    const deletedTag = await client.deleteTag(tag.id, { force: true });

    expect(deletedCategory.deleted).toBe(true);
    expect(deletedTag.deleted).toBe(true);
  });

  it('creates, updates, and deletes comments', async () => {
    const seedPost = await client.getPostBySlug('test-post-001');

    expect(seedPost).toBeDefined();

    const created = await client.createComment({
      post: seedPost!.id,
      content: 'Client CRUD comment body',
      status: 'approve',
    });

    createdComments.push(created.id);

    expect(created.id).toBeGreaterThan(0);
    expect(created.post).toBe(seedPost!.id);

    const updated = await client.updateComment(created.id, {
      content: 'Client CRUD comment body updated',
    });

    expect(updated.content.rendered).toContain('updated');

    const deleted = await client.deleteComment(created.id, { force: true });
    expect(deleted.deleted).toBe(true);
  });

  it('accepts custom Standard Schema validators for mutation responses', async () => {
    const minimalPostSchema: WordPressStandardSchema<{ id: number; slug: string; status: string }> = {
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

    const created = await client.createPage(
      {
        title: 'Client CRUD: Standard Schema create',
        status: 'draft',
      },
      minimalPostSchema,
    );

    createdPages.push(created.id);

    expect(created.id).toBeGreaterThan(0);
    expect(typeof created.slug).toBe('string');
    expect(created.status).toBe('draft');
  });
});
