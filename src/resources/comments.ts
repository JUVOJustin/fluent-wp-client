import type { WordPressComment } from '../schemas.js';
import type { WordPressRequestOverrides, PaginatedResponse } from '../types/resources.js';
import type { CommentsFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import { commentSchema } from '../standard-schemas.js';
import { BaseCrudResource } from '../core/resource-base.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress comments resource with full CRUD support.
 * 
 * @example
 * ```typescript
 * const comments = CommentsResource.create(runtime);
 * const allComments = await comments.getComments();
 * const comment = await comments.getComment(123);
 * ```
 */
export class CommentsResource extends BaseCrudResource<
  WordPressComment,
  ExtensibleFilter<CommentsFilter>,
  WordPressWritePayload,
  WordPressWritePayload
> {
  /**
   * Creates a comments resource instance.
   */
  static create(runtime: WordPressRuntime): CommentsResource {
    return new CommentsResource({
      runtime,
      endpoint: '/comments',
      defaultSchema: commentSchema,
    });
  }

  /**
   * Alias for list() - gets comments matching filter.
   */
  getComments(filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides): Promise<WordPressComment[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all comments via pagination.
   */
  getAllComments(
    filter?: Omit<ExtensibleFilter<CommentsFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressComment[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets comments with pagination metadata.
   */
  getCommentsPaginated(
    filter?: ExtensibleFilter<CommentsFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressComment>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getById() - gets comment by ID.
   */
  getComment(id: number, options?: WordPressRequestOverrides): Promise<WordPressComment> {
    return this.getById(id, options);
  }
}
