import type { WordPressBlockParser } from '../blocks.js';
import type { WordPressPost, WordPressPostWriteBase } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { ExtensibleFilter, PaginatedResponse } from '../types/resources.js';
import type { PostsFilter } from '../types/filters.js';
import { postSchema } from '../standard-schemas.js';
import { BasePostLikeResource } from '../core/resource-base.js';
import { WordPressContentQuery } from '../content-query.js';
import type { WordPressRuntime } from '../core/transport.js';

const missingRawPostMessage =
  'Raw post content is unavailable. The current credentials may not have edit capabilities for this post.';

/**
 * WordPress posts resource with full CRUD support.
 * 
 * @example
 * ```typescript
 * const posts = PostsResource.create(runtime);
 * const allPosts = await posts.getPosts();
 * const singlePost = await posts.getPost(123).get();
 * ```
 */
export class PostsResource extends BasePostLikeResource<
  WordPressPost,
  ExtensibleFilter<PostsFilter>,
  WordPressPostWriteBase
> {
  /**
   * Creates a posts resource instance.
   */
  static create(runtime: WordPressRuntime, defaultBlockParser?: WordPressBlockParser): PostsResource {
    return new PostsResource({
      runtime,
      endpoint: '/posts',
      missingRawMessage: missingRawPostMessage,
      defaultBlockParser,
      defaultSchema: postSchema,
    });
  }

  /**
   * Alias for list() - gets posts matching filter.
   */
  getPosts(filter?: ExtensibleFilter<PostsFilter>, options?: WordPressRequestOverrides): Promise<WordPressPost[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all posts via pagination.
   */
  getAllPosts(
    filter?: Omit<ExtensibleFilter<PostsFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressPost[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets posts with pagination metadata.
   */
  getPostsPaginated(
    filter?: ExtensibleFilter<PostsFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressPost>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getByIdAsQuery() - gets post by ID as content query.
   */
  getPost(id: number, options?: WordPressRequestOverrides): WordPressContentQuery<WordPressPost> {
    return this.getByIdAsQuery(id, options);
  }

  /**
   * Alias for getBySlugAsQuery() - gets post by slug as content query.
   */
  getPostBySlug(slug: string, options?: WordPressRequestOverrides): WordPressContentQuery<WordPressPost | undefined> {
    return this.getBySlugAsQuery(slug, options);
  }
}
