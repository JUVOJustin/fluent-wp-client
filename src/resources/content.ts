import { ContentItemQuery } from '../builders/content-item-query.js';
import {
  BasePostLikeResource,
  type PostLikeResourceContext,
} from '../core/resource-base.js';
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
import { describeUnavailable } from './describe.js';

/**
 * Ensures `_embedded` and `_links` are present in the `_fields` list when
 * embedding is active. Without them in `_fields`, WordPress strips the
 * embedded relation data from field-restricted responses.
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
  merged.add('_links');
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
  // @ts-expect-error - Type constraint complexity, safe at runtime
> extends BasePostLikeResource<TContent, QueryParams & PaginationParams, TCreate, TUpdate> {

  /**
   * Creates one awaitable single-item query.
   *
   * The `embed` option in `options` is forwarded to WordPress as `_embed`.
   * When `_fields` are also provided, `_embedded` and `_links` are automatically
   * added so WordPress does not strip the embedded data.
   */
  itemQuery(
    idOrSlug: number | string,
    options: (WordPressRequestOverrides & { embed?: boolean | string[]; fields?: string[] }) | undefined,
  ): ContentItemQuery<TContent> {
    const { embed, fields, ...requestOverrides } = options ?? {};
    const embedActive = embed === true || (Array.isArray(embed) && embed.length > 0);

    return new ContentItemQuery<TContent>(
      typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
      (id, queryOptions) => {
        const resolvedEmbed = queryOptions?.embed ?? embed;
        const resolvedFields = mergeRequestFields(fields, resolvedEmbed === true || (Array.isArray(resolvedEmbed) && resolvedEmbed.length > 0));
        return this.fetchContentById(id, requestOverrides, undefined, resolvedEmbed, resolvedFields);
      },
      (slug, queryOptions) => {
        const resolvedEmbed = queryOptions?.embed ?? embed;
        const resolvedFields = mergeRequestFields(fields, resolvedEmbed === true || (Array.isArray(resolvedEmbed) && resolvedEmbed.length > 0));
        return this.fetchContentBySlug(slug, requestOverrides, undefined, resolvedEmbed, resolvedFields);
      },
      embed,
      {
        getEditById: (id, editFields) => this.fetchContentById(id, requestOverrides, 'edit', false, editFields),
        getEditBySlug: (slug, editFields) => this.fetchContentBySlug(slug, requestOverrides, 'edit', false, editFields),
        missingRawMessage: this.missingRawMessage,
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
    list: (filter = {}, options) => resource.list(filter, options) as Promise<TResource[]>,
    listAll: (filter = {}, options, listOptions) => resource.listAll(filter, options, listOptions) as Promise<TResource[]>,
    listPaginated: (filter = {}, options) => resource.listPaginated(filter, options) as Promise<PaginatedResponse<TResource>>,
    item: (idOrSlug, options) => resource.itemQuery(idOrSlug, options),
    create: (input, options) => resource.create(input, options) as Promise<TResource>,
    update: (id, input, options) => resource.update(id, input, options) as Promise<TResource>,
    delete: (id, options) => resource.delete(id, options),
    describe: describeFn ?? describeUnavailable,
  };
}
