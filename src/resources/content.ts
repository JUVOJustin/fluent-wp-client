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
import type { WordPressStandardSchema } from '../core/validation.js';
import type { ListAllOptions } from '../core/pagination.js';
import { pageSchema, postSchema } from '../standard-schemas.js';
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
import {
  createSchemaValidators,
  createCrudClientMethods,
  shouldSkipValidation,
} from './schema-validation.js';

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
 * Built-in defaults for known post-like resources.
 */
export const knownContentDefaults = {
  pages: {
    defaultSchema: pageSchema,
    missingRawMessage: missingRawPageMessage,
  },
  posts: {
    defaultSchema: postSchema,
    missingRawMessage: missingRawPostMessage,
  },
} as const satisfies Record<string, {
  defaultSchema: WordPressStandardSchema<WordPressPostLike>;
  missingRawMessage: string;
}>;

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
  private readonly hasExplicitResponseSchema: boolean;
  private readonly validators: ReturnType<typeof createSchemaValidators<TContent>>;

  constructor(
    context: PostLikeResourceContext & {
      relationClient: PostRelationClient;
      responseSchema?: WordPressStandardSchema<TContent>;
    },
  ) {
    super(context as any);
    this.relationClient = context.relationClient;
    this.hasExplicitResponseSchema = context.responseSchema !== undefined;
    this.validators = createSchemaValidators(
      (context.responseSchema ?? context.defaultSchema) as WordPressStandardSchema<TContent> | undefined,
      'Content response validation failed',
    );
  }

  /**
   * Skips built-in schema validation for field-filtered list responses.
   */
  private shouldSkipValidation(filter: QueryParams | undefined): boolean {
    return !this.hasExplicitResponseSchema && filter?.fields !== undefined;
  }

  /**
   * Validates one resolved content item using the configured read schema.
   */
  async validateResolvedContent(value: TContent): Promise<TContent> {
    return this.validators.validate(value as unknown);
  }

  /**
   * Lists content with optional validation.
   */
  async listWithValidation(
    filter: QueryParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const items = await this.list(filter as QueryParams & PaginationParams, options);

    if (this.shouldSkipValidation(filter)) {
      return items as TContent[];
    }

    return this.validators.validateCollection(items as unknown[]);
  }

  /**
   * Lists every page of content with optional validation.
   */
  async listAllWithValidation(
    filter: Omit<QueryParams & PaginationParams, 'page'> = {},
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ): Promise<TContent[]> {
    const items = await this.listAll(filter, options, listOptions);

    if (this.shouldSkipValidation(filter)) {
      return items as TContent[];
    }

    return this.validators.validateCollection(items as unknown[]);
  }

  /**
   * Lists one page of content with pagination metadata and optional validation.
   */
  async listPaginatedWithValidation(
    filter: QueryParams & PaginationParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TContent>> {
    const result = await this.listPaginated(filter, options);

    if (this.shouldSkipValidation(filter)) {
      return result as PaginatedResponse<TContent>;
    }

    return {
      ...result,
      data: await this.validators.validateCollection(result.data as unknown[]),
    };
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
    finalizeContent?: (content: TContent) => PromiseLike<TContent>,
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
      finalizeContent,
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
  responseSchema?: WordPressStandardSchema<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
  const createRelationQuery = <TRelations extends readonly AllPostRelations[]>(
    idOrSlug: number | string,
    options: (WordPressRequestOverrides & { embed?: boolean; fields?: string[] }) | undefined,
    relations: TRelations,
  ): PostRelationQueryBuilder<TRelations, TResource> => {
    const skipValidation = shouldSkipValidation(responseSchema !== undefined, options?.fields ? { fields: options.fields } : undefined);

    return resource.itemQuery(
      idOrSlug,
      options,
      relations,
      // Field-restricted reads only skip built-in validation. Explicit caller
      // schemas still run so partial-response clients can validate their shape.
      skipValidation ? undefined : (content) => resource.validateResolvedContent(content),
    );
  };

  const crudMethods = createCrudClientMethods<TResource, WordPressWritePayload, WordPressWritePayload>(
    resource as unknown as Parameters<typeof createCrudClientMethods<TResource, WordPressWritePayload, WordPressWritePayload>>[0],
    responseSchema,
  );

  return {
    list: (filter = {}, options) => new ListRelationQueryBuilder(
      resource.getRelationClient(),
      filter as QueryParams & PaginationParams,
      (f, opts) => resource.listWithValidation(f, opts) as Promise<TResource[]>,
      options,
    ),
    listAll: (filter = {}, options, listOptions) => new ListAllRelationQueryBuilder(
      resource.getRelationClient(),
      filter as Omit<QueryParams & PaginationParams, 'page'>,
      (f, opts, lo) => resource.listAllWithValidation(f, opts, lo) as Promise<TResource[]>,
      options,
      [],
      listOptions,
    ),
    listPaginated: (filter = {}, options) => new PaginatedListRelationQueryBuilder(
      resource.getRelationClient(),
      filter as QueryParams & PaginationParams,
      (f, opts) => resource.listPaginatedWithValidation(f, opts) as Promise<PaginatedResponse<TResource>>,
      options,
    ),
    item: (idOrSlug, options) => createRelationQuery(idOrSlug, options, []),
    ...crudMethods,
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
