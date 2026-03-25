import { beforeAll, describe, expect, it } from 'vitest';
import { WordPressClient } from 'fluent-wp-client';
import { createAuthClient, createPublicClient } from '../helpers/wp-client';

/**
 * Integration coverage for fluent relation hydration APIs.
 */
describe('Client: post relation hydration', () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  function postsClient(client: WordPressClient) {
    return client.content('posts');
  }

  function pagesClient(client: WordPressClient) {
    return client.content('pages');
  }

  /**
   * Asserts author relation behavior for environments that expose or mask author IDs.
   */
  function expectAuthorRelation(authorId: number, relatedAuthor: { slug?: string } | null): void {
    if (authorId === 0) {
      expect(relatedAuthor).toBeNull();
      return;
    }

    expect(relatedAuthor).toBeTruthy();
    expect(relatedAuthor?.slug).toBe('admin');
  }

  it('hydrates related entities with content(\'posts\').item().with()', async () => {
    const post = await postsClient(authClient).item('test-post-001').with('author', 'terms');

    expect(post.slug).toBe('test-post-001');
    expectAuthorRelation(post.author, post.related.author);
    expect(post.related.terms.categories.length).toBeGreaterThan(0);
    expect(post.related.terms.tags.length).toBeGreaterThan(0);
  });

  it('hydrates relation data with awaitable content(\'posts\').item().with()', async () => {
    const hydrated = await authClient
      .content('posts')
      .item('test-post-002')
      .with('author', 'categories', 'tags', 'featuredMedia');

    expect(hydrated.slug).toBe('test-post-002');
    expectAuthorRelation(hydrated.author, hydrated.related.author);
    expect(Array.isArray(hydrated.related.categories)).toBe(true);
    expect(Array.isArray(hydrated.related.tags)).toBe(true);
    expect(hydrated.related.featuredMedia ?? null).toBeNull();
  });

  it('returns null author relation when public API masks author IDs', async () => {
    const hydrated = await postsClient(publicClient).item('test-post-001').with('author');

    expect(hydrated.author).toBe(0);
    expect(hydrated.related.author).toBeNull();
  });

  describe('parent relation', () => {
    it('hydrates parent relation for hierarchical pages via embedded data', async () => {
      // The child page 'services-web-development' should have 'services' as its parent
      const childPage = await pagesClient(authClient)
        .item('services-web-development')
        .with('parent');

      expect(childPage.slug).toBe('services-web-development');
      expect(childPage.parent).toBeGreaterThan(0);
      expect(childPage.related.parent).toBeDefined();
      expect(childPage.related.parent?.slug).toBe('services');
      expect(childPage.related.parent?.id).toBe(childPage.parent);
    });

    it('hydrates parent relation for pages with multiple children', async () => {
      // Test all child pages of 'services'
      const childSlugs = ['services-web-development', 'services-consulting', 'services-support'];

      for (const childSlug of childSlugs) {
        const childPage = await pagesClient(authClient).item(childSlug).with('parent');

        expect(childPage.parent).toBeGreaterThan(0);
        expect(childPage.related.parent).toBeDefined();
        expect(childPage.related.parent?.slug).toBe('services');
      }
    });

    it('returns null parent relation for top-level pages', async () => {
      // Top-level pages like 'about' should have parent=0 and null related.parent
      const topLevelPage = await pagesClient(authClient).item('about').with('parent');

      expect(topLevelPage.parent).toBe(0);
      expect(topLevelPage.related.parent).toBeNull();
    });

    it('hydrates parent with other relations together', async () => {
      const childPage = await pagesClient(authClient)
        .item('services-consulting')
        .with('parent', 'author');

      expect(childPage.slug).toBe('services-consulting');
      expect(childPage.related.parent).toBeDefined();
      expect(childPage.related.parent?.slug).toBe('services');
      expectAuthorRelation(childPage.author, childPage.related.author);
    });
  });
});
