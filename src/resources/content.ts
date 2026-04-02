import { PostRelationQueryBuilder } from '../builders/relations.js';
import type {
  AllPostRelations,
  ContentItemResult,
  PostRelationClient,
} from '../builders/relations.js';
import {
  ListRelationQueryBuilder,
  ListAllRelationQueryBuilder,
  PaginatedListRelationQueryBuilder,
} from '../builders/list-relations.js';
import {
  BasePostLikeResource,
  type PostLikeResourceContext,
} from '../core/resource-base.js';
import type { ListAllOptions } from '../core/pagination.js';
import type { WordPressPostLike } from '../schemas.js';
import type {
  ContentResourceClient,
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';

/**
 * Ensures `_embedded` is present in the `_fields` list when embedding is active.
 * WordPress includes `_embedded` as a top-level response key alongside the main
 * object fields. Without it in `_fields`, the embedded relation data is stripped
 * from the response even when `_embed=true` is set, forcing per-relation
 * fallback sub-requests instead of using the already-fetched embedded data.
 */
function mergeRequestFields(
  userFields: string[] | undefined,
  embedActive: boolean,
): string[] | undefined {
  if (!userFields || !embedActive) {
    return userFields;
  }

  const merged = new Set(userFields);
  merged.add('_embedded');
  return Array.from(merged);
}

const missingRawPostMessage =
  'Raw post content is unavailable. The current credentials may not have edit capabilities for this post.';

const missingRawPageMessage =
  'Raw page content is unavailable. The current credentials may not have edit capabilities for this page.';

/**
 * Known raw-content error messages for built-in post-like resources.
 */
export const knownContentDefaults = {
  pages: {
    missingRawMessage: missingRawPageMessage,
  },
  posts: {
    missingRawMessage: missingRawPostMessage,
  },
} as const satisfies Record<string, { missingRawMessage: string }>;

/**
 * Generic post-like resource used by core posts, pages, and custom post types.
 */
export class GenericContentResource<
  TContent extends WordPressPostLike = WordPressPostLike,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
  // @ts-ignore - Type constraint complexity, safe at runtime
> extends BasePostLikeResource<TContent, QueryParams & PaginationParams, TCreate, TUpdate> {
  private readonly relationClient: PostRelationClient;

  constructor(
    context: PostLikeResourceContext & {
      relationClient: PostRelationClient;
    },
  ) {
    super(context as any);
    this.relationClient = context.relationClient;
  }

  /**
   * Returns the relation client for building relation queries.
   */
  getRelationClient(): PostRelationClient {
    return this.relationClient;
  }

  /**
   * Creates one awaitable single-item query with optional relation hydration.
   * Extracts `embed` and `fields` from options before wiring closures so that
   * `_fields` is correctly sent and `_embedded` is preserved when relation
   * hydration enables embed on a field-restricted request.
   */
  itemQuery<TRelations extends readonly AllPostRelations[]>(
    idOrSlug: number | string,
    options: (WordPressRequestOverrides & { embed?: boolean; fields?: string[] }) | undefined,
    relations: TRelations,
  ): PostRelationQueryBuilder<TRelations, TContent> {
    const { embed, fields, ...requestOverrides } = options ?? {};
    const userRequestedEmbed = embed === true;

    return new PostRelationQueryBuilder<TRelations, TContent>(
      this.relationClient,
      typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
      (id, queryOptions) => {
        const resolvedFields = mergeRequestFields(fields, queryOptions?.embed === true);
        return this.fetchContentById(id, requestOverrides, undefined, queryOptions?.embed, resolvedFields);
      },
      (slug, queryOptions) => {
        const resolvedFields = mergeRequestFields(fields, queryOptions?.embed === true);
        return this.fetchContentBySlug(slug, requestOverrides, undefined, queryOptions?.embed, resolvedFields);
      },
      relations,
      {
        getEditById: (id, editFields) => this.fetchContentById(id, requestOverrides, 'edit', false, editFields),
        getEditBySlug: (slug, editFields) => this.fetchContentBySlug(slug, requestOverrides, 'edit', false, editFields),
        missingRawMessage: this.missingRawMessage,
        userRequestedEmbed,
      },
    );
  }
}

/**
 * Creates a typed content client from one generic post-like resource.
 */
export function createContentClient<TResource extends WordPressPostLike>(
  resource: GenericContentResource<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
  return {
    list: (filter = {}, options) => new ListRelationQueryBuilder(
      resource.getRelationClient(),
      filter as QueryParams & PaginationParams,
      (f, opts) => resource.list(f, opts) as Promise<TResource[]>,
      options,
    ),
    listAll: (filter = {}, options, listOptions) => new ListAllRelationQueryBuilder(
      resource.getRelationClient(),
      filter as Omit<QueryParams & PaginationParams, 'page'>,
      (f, opts, lo) => resource.listAll(f, opts, lo) as Promise<TResource[]>,
      options,
      [],
      listOptions,
    ),
    listPaginated: (filter = {}, options) => new PaginatedListRelationQueryBuilder(
      resource.getRelationClient(),
      filter as QueryParams & PaginationParams,
      (f, opts) => resource.listPaginated(f, opts) as Promise<PaginatedResponse<TResource>>,
      options,
    ),
    item: (idOrSlug, options) => resource.itemQuery(idOrSlug, options, []),
    create: (input, options) => resource.create(input, options) as Promise<TResource>,
    update: (id, input, options) => resource.update(id, input, options) as Promise<TResource>,
    delete: (id, options) => resource.delete(id, options),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
