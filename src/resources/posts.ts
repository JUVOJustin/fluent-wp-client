import type { WordPressBlockParser } from '../blocks.js';
import { createPostLikeReadMethods } from '../content-read-methods.js';
import type { WordPressPost } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import type { FetchResult } from '../types/resources.js';
import type { PostsFilter } from '../types/filters.js';

const missingRawPostMessage =
  'Raw post content is unavailable. The current credentials may not have edit capabilities for this post.';

/**
 * Posts API methods factory for typed read operations.
 */
export function createPostsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>,
  defaultBlockParser?: WordPressBlockParser,
) {
  const core = createPostLikeReadMethods<WordPressPost, PostsFilter>({
    resource: 'posts',
    missingRawMessage: missingRawPostMessage,
    fetchAPI,
    fetchAPIPaginated,
    defaultBlockParser,
  });

  return {
    /**
     * Gets posts with optional filtering (single page, max 100 items).
     */
    getPosts: core.list,

    /**
     * Gets all posts by automatically paginating through all pages.
     */
    getAllPosts: core.listAll,

    /**
     * Gets posts with pagination metadata.
     */
    getPostsPaginated: core.listPaginated,

    /**
     * Gets one post by ID.
     */
    getPost: core.getById,

    /**
     * Gets one post by slug.
     */
    getPostBySlug: core.getBySlug,
  };
}
