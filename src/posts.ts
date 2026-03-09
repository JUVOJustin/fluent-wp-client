import type { WordPressPost } from './schemas.js';
import type { WordPressBlockParser } from './blocks.js';
import type { FetchResult, PaginatedResponse, PostsFilter } from './types.js';
import { WordPressContentQuery } from './content-query.js';
import { filterToParams } from './types.js';

/**
 * Posts API methods factory for typed read operations.
 */
export function createPostsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  defaultBlockParser?: WordPressBlockParser,
) {
  return {
    /**
     * Gets posts with optional filtering (single page, max 100 items).
     */
    async getPosts(filter: PostsFilter = {}): Promise<WordPressPost[]> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      return fetchAPI<WordPressPost[]>('/posts', params);
    },

    /**
     * Gets all posts by automatically paginating through all pages.
     */
    async getAllPosts(filter: Omit<PostsFilter, 'page'> = {}): Promise<WordPressPost[]> {
      const allPosts: WordPressPost[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
        const result = await fetchAPIPaginated<WordPressPost[]>('/posts', params);
        allPosts.push(...result.data);
        totalPages = result.totalPages;
        page += 1;
      } while (page <= totalPages);

      return allPosts;
    },

    /**
     * Gets posts with pagination metadata.
     */
    async getPostsPaginated(filter: PostsFilter = {}): Promise<PaginatedResponse<WordPressPost>> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      const result = await fetchAPIPaginated<WordPressPost[]>('/posts', params);

      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
    },

    /**
     * Gets one post by ID.
     */
    getPost(id: number): WordPressContentQuery<WordPressPost> {
      return new WordPressContentQuery<WordPressPost>(
        () => fetchAPI<WordPressPost>(`/posts/${id}`, { _embed: 'true' }),
        () => fetchAPI<WordPressPost>(`/posts/${id}`, { _embed: 'true', context: 'edit' }),
        (post) => {
          if (post.content.raw === undefined) {
            throw new Error(
              'Raw post content is unavailable. The current credentials may not have edit capabilities for this post.',
            );
          }

          return {
            raw: post.content.raw,
            rendered: post.content.rendered,
            protected: post.content.protected,
          };
        },
        defaultBlockParser,
      );
    },

    /**
     * Gets one post by slug.
     */
    getPostBySlug(slug: string): WordPressContentQuery<WordPressPost | undefined> {
      return new WordPressContentQuery<WordPressPost | undefined>(
        async () => {
          const posts = await fetchAPI<WordPressPost[]>('/posts', { slug, _embed: 'true' });
          return posts[0];
        },
        async () => {
          const posts = await fetchAPI<WordPressPost[]>('/posts', { slug, _embed: 'true', context: 'edit' });
          return posts[0];
        },
        (post) => {
          if (!post) {
            return undefined;
          }

          if (post.content.raw === undefined) {
            throw new Error(
              'Raw post content is unavailable. The current credentials may not have edit capabilities for this post.',
            );
          }

          return {
            raw: post.content.raw,
            rendered: post.content.rendered,
            protected: post.content.protected,
          };
        },
        defaultBlockParser,
      );
    },
  };
}
