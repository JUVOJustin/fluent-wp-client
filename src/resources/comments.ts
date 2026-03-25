import type {
  WordPressAuthor,
  WordPressComment,
  WordPressPostLike,
} from '../schemas.js';
import type {
  AllCommentRelations,
  CommentsResourceClient,
  PaginatedResponse,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { CommentsFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { commentSchema } from '../standard-schemas.js';
import { BaseCrudResource } from '../core/resource-base.js';
import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import {
  createSingleExtractor,
  extractEmbeddedData,
  type PostRelationClient,
} from '../builders/relation-contracts.js';
import { resolveMutationSchema } from '../core/mutation-helpers.js';
import { createSchemaValidators, shouldSkipValidation } from './schema-validation.js';

const extractEmbeddedAuthor = createSingleExtractor(
  (item: unknown) => item as WordPressAuthor,
);

const extractEmbeddedPost = createSingleExtractor(
  (item: unknown) => item as WordPressPostLike,
);

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
    return new CommentsResource({
      runtime,
      endpoint: '/comments',
      defaultSchema: commentSchema,
    });
  }
}

/**
 * Creates a typed comments client with optional read and mutation validation.
 */
export function createCommentsClient<TResource extends WordPressComment = WordPressComment>(
  resource: CommentsResource,
  relationClient: PostRelationClient,
  responseSchema?: WordPressStandardSchema<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): CommentsResourceClient<TResource, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload> {
  const hasExplicitResponseSchema = responseSchema !== undefined;
  const validators = createSchemaValidators(
    (responseSchema ?? commentSchema) as WordPressStandardSchema<TResource>,
    'Comment response validation failed',
  );

  const builtInRelations = new Set<AllCommentRelations>(['author', 'post', 'parent']);

  const loadComment = async (id: number, options?: WordPressRequestOverrides) =>
    validators.validate(await resource.getById(id, options) as unknown);

  const resolveAuthorRelation = async (comment: TResource): Promise<WordPressAuthor | null> => {
    const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(comment, 'author'));

    if (embeddedAuthor) {
      return embeddedAuthor;
    }

    const authorId = comment.author;

    if (typeof authorId !== 'number' || authorId <= 0) {
      return null;
    }

    const usersClient = relationClient.users();
    let direct: WordPressAuthor | null = null;

    try {
      direct = await usersClient.item(authorId) ?? null;
    } catch {
      direct = null;
    }

    if (direct) {
      return direct;
    }

    const users = await usersClient.list({ include: [authorId], perPage: 1 }).catch(() => []);
    return users[0] ?? null;
  };

  const resolvePostRelation = async (comment: TResource): Promise<WordPressPostLike | null> => {
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

  const resolveParentRelation = async (comment: TResource): Promise<WordPressComment | null> => {
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
    () => loadComment(id, options),
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
  )) as CommentsResourceClient<TResource, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload>['item'];

  return {
    list: async (filter = {}, options) => {
      const items = await resource.list(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listAll: async (filter = {}, options) => {
      const items = await resource.listAll(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listPaginated: async (filter = {}, options) => {
      const result = await resource.listPaginated(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return result as PaginatedResponse<TResource>;
      }

      return {
        ...result,
        data: await validators.validateCollection(result.data as unknown[]),
      };
    },
    item,
    create: <TResponse = TResource>(
      input: WordPressWritePayload,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
        responseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      return resource.create<TResponse>(
        input,
        resolved.responseSchema,
        resolved.requestOptions,
      );
    },
    update: <TResponse = TResource>(
      id: number,
      input: WordPressWritePayload,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
        responseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      return resource.update<TResponse>(
        id,
        input,
        resolved.responseSchema,
        resolved.requestOptions,
      );
    },
    delete: (id, options) => resource.delete(id, options),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
