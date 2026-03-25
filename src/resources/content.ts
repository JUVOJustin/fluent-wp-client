import { PostRelationQueryBuilder } from '../builders/relations.js';
import type {
  AllPostRelations,
  ContentItemResult,
  PostRelationClient,
} from '../builders/relations.js';
import {
  BasePostLikeResource,
  type PostLikeResourceContext,
} from '../core/resource-base.js';
import type { WordPressStandardSchema } from '../core/validation.js';
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
import { resolveMutationArguments } from '../core/mutation-helpers.js';
import { createSchemaValidators } from './schema-validation.js';

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
  ): Promise<TContent[]> {
    const items = await this.listAll(filter, options);

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
   * Gets one item by ID with optional validation.
   */
  async getWithValidation(
    id: number,
    options?: WordPressRequestOverrides,
  ): Promise<TContent> {
    const item = await this.getById(id, options);
    return this.validators.validate(item as unknown);
  }

  /**
   * Gets one item by slug with optional validation.
   */
  async getBySlugWithValidation(
    slug: string,
    options?: WordPressRequestOverrides,
  ): Promise<TContent | undefined> {
    const item = await this.getBySlug(slug, options);

    if (item === undefined) {
      return undefined;
    }

    return this.validators.validate(item as unknown);
  }

  /**
   * Creates one awaitable single-item query with optional relations and block helpers.
   */
  itemQuery<TRelations extends readonly AllPostRelations[]>(
    idOrSlug: number | string,
    options: WordPressRequestOverrides | undefined,
    relations: TRelations,
    finalizeContent?: (content: TContent) => PromiseLike<TContent>,
  ): PostRelationQueryBuilder<TRelations, TContent> {
    return new PostRelationQueryBuilder<TRelations, TContent>(
      this.relationClient,
      typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
      (id, queryOptions) => this.fetchContentById(id, options, undefined, queryOptions?.embed),
      (slug, queryOptions) => this.fetchContentBySlug(slug, options, undefined, queryOptions?.embed),
      relations,
      finalizeContent,
      {
        getEditById: (id) => this.fetchContentById(id, options, 'edit'),
        getEditBySlug: (slug) => this.fetchContentBySlug(slug, options, 'edit'),
        missingRawMessage: this.missingRawMessage,
        defaultBlockParser: this.defaultBlockParser,
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
): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
  const createRelationQuery = <TRelations extends readonly AllPostRelations[]>(
    idOrSlug: number | string,
    options: WordPressRequestOverrides | undefined,
    relations: TRelations,
  ): PostRelationQueryBuilder<TRelations, TResource> => resource.itemQuery(
    idOrSlug,
    options,
    relations,
    (content) => resource.validateResolvedContent(content),
  );

  const resolveMutationSchema = <TResponse>(
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): {
    requestOptions?: WordPressRequestOverrides;
    responseSchema?: WordPressStandardSchema<TResponse>;
  } => {
    const resolved = resolveMutationArguments<TResponse>(
      responseSchemaOrRequestOptions,
      requestOptions,
    );

    return {
      requestOptions: resolved.requestOptions,
      responseSchema: resolved.responseSchema
        ?? (responseSchema as WordPressStandardSchema<TResponse> | undefined),
    };
  };

  return {
    list: async (filter = {}, options) => resource.listWithValidation(filter, options) as Promise<TResource[]>,
    listAll: async (filter = {}, options) => resource.listAllWithValidation(
      filter as Omit<QueryParams & PaginationParams, 'page'>,
      options,
    ) as Promise<TResource[]>,
    listPaginated: async (filter = {}, options) => resource.listPaginatedWithValidation(
      filter as QueryParams & PaginationParams,
      options,
    ) as Promise<PaginatedResponse<TResource>>,
    getById: async (id, options) => resource.getWithValidation(id, options) as Promise<TResource>,
    getBySlug: async (slug, options) => resource.getBySlugWithValidation(slug, options) as Promise<TResource | undefined>,
    item: (idOrSlug, options) => createRelationQuery(idOrSlug, options, []),
    getWithRelations: async <TRelations extends readonly AllPostRelations[]>(
      idOrSlug: number | string,
      ...relations: TRelations
    ): Promise<ContentItemResult<TResource, TRelations>> => {
      const query = createRelationQuery(idOrSlug, undefined, relations);
      return query.get() as Promise<ContentItemResult<TResource, TRelations>>;
    },
    create: <TResponse = TResource>(
      input: WordPressWritePayload,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
      );

      return resource.create<TResponse>(
        input,
        resolved.responseSchema as WordPressStandardSchema<TResponse> | undefined,
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
      );

      return resource.update<TResponse>(
        id,
        input,
        resolved.responseSchema as WordPressStandardSchema<TResponse> | undefined,
        resolved.requestOptions,
      );
    },
    delete: (id, options) => resource.delete(id, options),
  };
}
