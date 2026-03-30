import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createPublicClient,
  createAuthClient,
} from '../helpers/wp-client';
import type { WordPressClient } from 'fluent-wp-client';
import {
  getPostsTool,
  getPostTool,
  createPostTool,
  updatePostTool,
  deletePostTool,
  getPagesTool,
  getCategoriesTool,
  getCategoryTool,
  getTagsTool,
  getCommentsTool,
  getUsersTool,
  getSettingsTool,
  getContentCollectionTool,
  getContentTool,
  getTermCollectionTool,
  getBlocksTool,
  setBlocksTool,
} from 'fluent-wp-client/ai-sdk';

/**
 * Invokes a tool's execute method and returns the non-iterable result.
 * AI SDK tool execute may return `T | AsyncIterable<T>`. Our tools
 * always return plain promises, so this cast is safe in tests.
 */
async function run<T>(tool: { execute?: Function }, args: Record<string, unknown>): Promise<T> {
  const result = await tool.execute!(args, { toolCallId: 'test', messages: [] });
  return result as T;
}

describe('AI SDK tool integration', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  // -----------------------------------------------------------------------
  // Collection reads
  // -----------------------------------------------------------------------

  describe('collection tools', () => {
    it('getPostsTool returns an array of posts', async () => {
      const tool = getPostsTool(publicClient, { fixedArgs: { perPage: 3 } });
      const result = await run<unknown[]>(tool, { perPage: 3 });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');
    });

    it('getPostsTool supports search', async () => {
      const tool = getPostsTool(publicClient);
      // Search for posts - WordPress search may return 0 or more results depending on index
      const result = await run<unknown[]>(tool, { search: 'test' });
      expect(Array.isArray(result)).toBe(true);
      // Result may be empty if search index isn't populated; just verify no error thrown
    });

    it('getPostsTool supports pagination', async () => {
      const tool = getPostsTool(publicClient);
      const page1 = await run<unknown[]>(tool, { perPage: 2, page: 1 });
      const page2 = await run<unknown[]>(tool, { perPage: 2, page: 2 });
      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeLessThanOrEqual(2);
      expect((page1[0] as { id: number }).id).not.toBe((page2[0] as { id: number }).id);
    });

    it('getCategoriesTool returns categories', async () => {
      const tool = getCategoriesTool(publicClient);
      const result = await run<unknown[]>(tool, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
    });

    it('getTagsTool returns tags', async () => {
      const tool = getTagsTool(publicClient);
      const result = await run<unknown[]>(tool, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('getPagesTool returns pages', async () => {
      const tool = getPagesTool(publicClient);
      const result = await run<unknown[]>(tool, { perPage: 5 });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('getUsersTool returns users with auth', async () => {
      const tool = getUsersTool(authClient);
      const result = await run<unknown[]>(tool, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('getCommentsTool returns comments', async () => {
      const tool = getCommentsTool(publicClient);
      const result = await run<unknown[]>(tool, {});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Single item getters
  // -----------------------------------------------------------------------

  describe('single item tools', () => {
    it('getPostTool fetches by ID with content envelope', async () => {
      // Content envelope requires edit context (authentication)
      const tool = getPostTool(authClient, { defaultArgs: { includeContent: true } });
      const posts = await authClient.content('posts').list({ perPage: 1 });
      const id = posts[0].id;

      const result = await run<{ item: { id: number }; content?: unknown }>(tool, { id, includeContent: true });
      expect(result).toHaveProperty('item');
      expect(result.item).toHaveProperty('id', id);
      expect(result).toHaveProperty('content');
    });

    it('getPostTool fetches by slug', async () => {
      const tool = getPostTool(publicClient);
      const result = await run<{ item: { slug: string } }>(tool, { slug: 'test-post-001' });
      expect(result).toHaveProperty('item');
      expect(result.item).toHaveProperty('slug', 'test-post-001');
    });

    it('getCategoryTool fetches by ID', async () => {
      const tool = getCategoryTool(publicClient);
      const categories = await publicClient.terms('categories').list({ perPage: 1 });
      const id = categories[0].id;

      const result = await run<{ id: number }>(tool, { id });
      expect(result).toHaveProperty('id', id);
    });

    it('getCategoryTool fetches by slug', async () => {
      const tool = getCategoryTool(publicClient);
      const result = await run<{ slug: string }>(tool, { slug: 'technology' });
      expect(result).toHaveProperty('slug', 'technology');
    });

    it('getSettingsTool returns settings', async () => {
      const tool = getSettingsTool(authClient);
      const result = await run<{ title: string }>(tool, {});
      expect(result).toHaveProperty('title');
    });
  });

  // -----------------------------------------------------------------------
  // CRUD tools
  // -----------------------------------------------------------------------

  describe('mutation tools', () => {
    const cleanupIds: number[] = [];

    afterAll(async () => {
      for (const id of cleanupIds) {
        try { await authClient.content('posts').delete(id, { force: true }); } catch { /* ignore */ }
      }
    });

    it('createPostTool creates a post', async () => {
      const tool = createPostTool(authClient, { fixedInput: { status: 'draft' } });
      const result = await run<{ id: number; title: unknown }>(tool, {
        input: { title: 'AI SDK Test Post', content: 'Created by AI SDK tool test' },
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      cleanupIds.push(result.id);
    });

    it('updatePostTool updates a post', async () => {
      const created = await authClient.content('posts').create({ title: 'Update Target', status: 'draft' });
      cleanupIds.push(created.id);

      const tool = updatePostTool(authClient);
      const result = await run<{ id: number }>(tool, { id: created.id, input: { title: 'Updated Title' } });
      expect(result).toHaveProperty('id', created.id);
    });

    it('deletePostTool deletes a post', async () => {
      const created = await authClient.content('posts').create({ title: 'Delete Target', status: 'draft' });
      const tool = deletePostTool(authClient);
      const result = await run<{ deleted: boolean }>(tool, { id: created.id, force: true });
      expect(result).toHaveProperty('deleted', true);
    });
  });

  // -----------------------------------------------------------------------
  // Developer configuration (defaultArgs, fixedArgs)
  // -----------------------------------------------------------------------

  describe('developer configuration', () => {
    it('fixedArgs override model input', async () => {
      const tool = getPostsTool(publicClient, { fixedArgs: { perPage: 2 } });
      const result = await run<unknown[]>(tool, { perPage: 50 });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('defaultArgs provide fallback values', async () => {
      const tool = getPostsTool(publicClient, { defaultArgs: { perPage: 3 } });
      const result = await run<unknown[]>(tool, {});
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  // -----------------------------------------------------------------------
  // Generic content/term tools (CPT/taxonomy)
  // -----------------------------------------------------------------------

  describe('generic resource tools', () => {
    it('getContentCollectionTool lists custom post type', async () => {
      const tool = getContentCollectionTool(publicClient, 'books');
      const result = await run<unknown[]>(tool, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('getContentTool fetches a single CPT item by ID', async () => {
      const items = await publicClient.content('books').list() as { id: number }[];
      if (items.length === 0) return;

      const tool = getContentTool(publicClient, 'books');
      const result = await run<{ id: number }>(tool, { id: items[0].id });
      expect(result).toHaveProperty('id');
    });

    it('getTermCollectionTool lists custom taxonomy terms', async () => {
      const tool = getTermCollectionTool(authClient, 'genre');
      const result = await run<unknown[]>(tool, {});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Block read/write tools
  // -----------------------------------------------------------------------

  describe('block tools', () => {
    let blockTestPostId: number;

    beforeAll(async () => {
      const post = await authClient.content('posts').create({
        title: 'Block Tool Test Post',
        content: '<!-- wp:paragraph -->\n<p>Original content</p>\n<!-- /wp:paragraph -->',
        status: 'draft',
      });
      blockTestPostId = post.id;
    });

    afterAll(async () => {
      if (blockTestPostId) {
        try { await authClient.content('posts').delete(blockTestPostId, { force: true }); } catch { /* ignore */ }
      }
    });

    it('getBlocksTool returns parsed block structure', async () => {
      const tool = getBlocksTool(authClient);
      const result = await run<{ id: number; resource: string; blocks: unknown[] }>(tool, {
        resource: 'posts',
        id: blockTestPostId,
      });

      expect(result).toHaveProperty('id', blockTestPostId);
      expect(result).toHaveProperty('resource', 'posts');
      expect(Array.isArray(result.blocks)).toBe(true);
      expect(result.blocks.length).toBeGreaterThan(0);
      const firstBlock = result.blocks[0] as { blockName: string };
      expect(firstBlock).toHaveProperty('blockName', 'core/paragraph');
    });

    it('setBlocksTool writes block structure and getBlocksTool reads it back', async () => {
      const newBlocks = [
        {
          blockName: 'core/paragraph',
          attrs: {},
          innerBlocks: [],
          innerHTML: '\n<p>Updated via AI SDK tool</p>\n',
          innerContent: ['\n<p>Updated via AI SDK tool</p>\n'],
        },
        {
          blockName: 'core/heading',
          attrs: { level: 2 },
          innerBlocks: [],
          innerHTML: '\n<h2>AI-generated heading</h2>\n',
          innerContent: ['\n<h2>AI-generated heading</h2>\n'],
        },
      ];

      const setTool = setBlocksTool(authClient);
      const setResult = await run<{ updated: boolean }>(setTool, {
        resource: 'posts',
        id: blockTestPostId,
        blocks: newBlocks,
      });
      expect(setResult).toHaveProperty('updated', true);

      // Read back and confirm block names survived the round-trip.
      const getTool = getBlocksTool(authClient);
      const getResult = await run<{ blocks: Array<{ blockName: string }> }>(getTool, {
        resource: 'posts',
        id: blockTestPostId,
      });

      const blockNames = getResult.blocks
        .filter((b) => b.blockName)
        .map((b) => b.blockName);

      expect(blockNames).toContain('core/paragraph');
      expect(blockNames).toContain('core/heading');
    });

    it('setBlocksTool rejects malformed inner block placeholder structures', async () => {
      const setTool = setBlocksTool(authClient);

      await expect(run(setTool, {
        resource: 'posts',
        id: blockTestPostId,
        blocks: [{
          blockName: 'core/group',
          attrs: {},
          innerBlocks: [{
            blockName: 'core/paragraph',
            attrs: {},
            innerBlocks: [],
            innerHTML: '<p>Nested child</p>',
            innerContent: ['<p>Nested child</p>'],
          }],
          innerHTML: '',
          innerContent: [],
        }],
      })).rejects.toThrow('WordPress block validation failed');
    });
  });
});
