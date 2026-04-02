import type {
  WordPressAuthor,
  WordPressComment,
  WordPressPostLike,
} from '../schemas.js';
import type {
  AllCommentRelations,
  CommentsResourceClient,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { CommentsFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { BaseCrudResource } from '../core/resource-base.js';
import type { WordPressRuntime } from '../core/transport.js';
import { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import {
  createSingleExtractor,
  extractEmbeddedData,
  type PostRelationClient,
} from '../builders/relation-contracts.js';
import {
  extractEmbeddedAuthor,
  extractEmbeddedPost,
  resolveAuthorById,
} from '../builders/item-relation-resolver.js';

const extractEmbeddedComment = createSingleExtractor(
  (item: unknown) => item as WordPressComment,
);

/**
 * WordPress comments resource with full CRUD support.
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
    return new CommentsResource({ runtime, endpoint: '/comments' });
  }
}

/**
 * Creates a typed comments client.
 */
export function createCommentsClient(
  resource: CommentsResource,
  relationClient: PostRelationClient,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): CommentsResourceClient<WordPressComment, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload> {
  const builtInRelations = new Set<AllCommentRelations>(['author', 'post', 'parent']);

  const resolveAuthorRelation = async (comment: WordPressComment): Promise<WordPressAuthor | null> => {
    const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(comment, 'author'));

    if (embeddedAuthor) {
      return embeddedAuthor;
    }

    return resolveAuthorById(relationClient, comment.author);
  };

  const resolvePostRelation = async (comment: WordPressComment): Promise<WordPressPostLike | null> => {
    const embeddedPost = extractEmbeddedPost(extractEmbeddedData(comment, 'up'));

    if (embeddedPost) {
      return embeddedPost;
    }

    const upLinks = (comment as { _links?: Record<string, unknown> })._links?.up as Array<Record<string, unknown>> | undefined;
    const linkedPost = upLinks?.[0];

    if (linkedPost && relationClient.request && typeof linkedPost.href === 'string') {
      try {
        const { data, response } = await relationClient.request<WordPressPostLike>({
          endpoint: linkedPost.href,
          method: 'GET',
        });

        if (response.ok) {
          return data;
        }
      } catch {
        // Ignore link fetch failures and fall back to typed lookup when possible.
      }
    }

    const postType = typeof linkedPost?.post_type === 'string' ? linkedPost.post_type : undefined;

    if (typeof comment.post === 'number' && comment.post > 0 && postType) {
      try {
        const post = await relationClient.content(postType).item(comment.post);
        return post ?? null;
      } catch {
        return null;
      }
    }

    return null;
  };

  const resolveParentRelation = async (comment: WordPressComment): Promise<WordPressComment | null> => {
    const embeddedParent = extractEmbeddedComment(extractEmbeddedData(comment, 'in-reply-to'));

    if (embeddedParent) {
      return embeddedParent;
    }

    if (typeof comment.parent !== 'number' || comment.parent <= 0) {
      return null;
    }

    try {
      const parent = await relationClient.comments().item(comment.parent);
      return parent ?? null;
    } catch {
      return null;
    }
  };

  const item = ((
    id: number,
    options?: WordPressRequestOverrides,
  ) => new ResourceItemQueryBuilder(
    relationClient,
    () => resource.getById(id, options),
    builtInRelations,
    async (comment, relationSet) => {
      const related: Record<string, unknown> = {};

      if (relationSet.has('author')) {
        related.author = await resolveAuthorRelation(comment);
      }

      if (relationSet.has('post')) {
        related.post = await resolvePostRelation(comment);
      }

      if (relationSet.has('parent')) {
        related.parent = await resolveParentRelation(comment);
      }

      return related;
    },
  )) as CommentsResourceClient<WordPressComment, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload>['item'];

  return {
    list: (filter = {}, options) => resource.list(filter, options),
    listAll: (filter = {}, options, listOptions) => resource.listAll(filter, options, listOptions),
    listPaginated: (filter = {}, options) => resource.listPaginated(filter, options),
    create: (input, options) => resource.create(input, options),
    update: (id, input, options) => resource.update(id, input, options),
    item,
    delete: (id, options) => resource.delete(id, options),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
