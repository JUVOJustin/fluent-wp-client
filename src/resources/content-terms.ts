import type { WordPressPostLike, WordPressCategory } from '../schemas.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type {
  AllPostRelations,
  PostRelationClient,
  SelectedPostRelations,
} from '../builders/relations.js';
import {
  BaseCrudResource,
  BasePostLikeResource,
  type PostLikeResourceContext,
} from '../core/resource-base.js';
import type {
  ContentResourceClient,
  TermsResourceClient,
  PaginatedResponse,
  PaginationParams,
  WordPressRequestOverrides,
  WordPressDeleteResult,
} from '../types/resources.js';
import type { QueryParams } from '../types/resources.js';
import type {
  DeleteOptions,
  TermWriteInput,
  WordPressWritePayload,
} from '../types/payloads.js';
import { PostRelationQueryBuilder } from '../builders/relations.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * Runtime dependencies required for generic content and term resources.
 */
export interface GenericResourceContext {
  runtime: WordPressRuntime;
  relationClient: PostRelationClient;
}

/**
 * Generic content resource for custom post types.
 * Extends BasePostLikeResource with post-like behavior (_embed, content queries).
 */
class GenericContentResource<
  TContent extends WordPressPostLike = WordPressPostLike,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
  // @ts-ignore - Type constraint complexity, safe at runtime
> extends BasePostLikeResource<TContent, QueryParams & PaginationParams, TCreate, TUpdate> {
  private responseSchema?: WordPressStandardSchema<TContent>;

  constructor(context: PostLikeResourceContext & { responseSchema?: WordPressStandardSchema<TContent> }) {
    super(context as any);
    this.responseSchema = context.responseSchema;
  }

  /**
   * Validates content items when a schema is configured.
   */
  private async validate<T>(value: unknown): Promise<T> {
    if (!this.responseSchema) {
      return value as T;
    }
    const { validateWithStandardSchema } = await import('../core/validation.js');
    // @ts-ignore - Schema type complexity
    return validateWithStandardSchema(this.responseSchema, value, 'Content response validation failed');
  }

  /**
   * Validates a collection of items.
   */
  private async validateCollection<T>(values: unknown[]): Promise<T[]> {
    if (!this.responseSchema) {
      return values as T[];
    }
    return Promise.all(values.map((v) => this.validate<T>(v)));
  }

  /**
   * Lists content with optional validation.
   */
  async listWithValidation(
    filter: QueryParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const items = await this.list(filter as QueryParams & PaginationParams, options);
    return this.validateCollection<TContent>(items as unknown[]);
  }

  /**
   * Lists every page of content with optional validation.
   */
  async listAllWithValidation(
    filter: Omit<QueryParams & PaginationParams, 'page'> = {},
    options?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const items = await this.listAll(filter, options);
    return this.validateCollection<TContent>(items as unknown[]);
  }

  /**
   * Lists one page of content with pagination metadata and optional validation.
   */
  async listPaginatedWithValidation(
    filter: QueryParams & PaginationParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TContent>> {
    const result = await this.listPaginated(filter, options);

    return {
      ...result,
      data: await this.validateCollection<TContent>(result.data as unknown[]),
    };
  }

  /**
   * Gets single item by ID with optional validation.
   */
  async getWithValidation(
    id: number,
    options?: WordPressRequestOverrides,
  ): Promise<TContent> {
    const item = await this.getById(id, options);
    return this.validate<TContent>(item as unknown);
  }

  /**
   * Gets single item by slug with optional validation.
   */
  async getBySlugWithValidation(
    slug: string,
    options?: WordPressRequestOverrides,
  ): Promise<TContent | undefined> {
    const item = await this.getBySlug(slug, options);
    if (item === undefined) {
      return undefined;
    }
    return this.validate<TContent>(item as unknown);
  }
}

/**
 * Generic term resource for custom taxonomies.
 * Extends BaseCrudResource for basic collection + CRUD operations.
 */
class GenericTermResource<
  TTerm = WordPressCategory,
  TCreate extends WordPressWritePayload = TermWriteInput,
  TUpdate extends WordPressWritePayload = TCreate,
> extends BaseCrudResource<TTerm, QueryParams & PaginationParams, TCreate, TUpdate> {
  private responseSchema?: WordPressStandardSchema<TTerm>;

  constructor(context: {
    runtime: WordPressRuntime;
    endpoint: string;
    responseSchema?: WordPressStandardSchema<TTerm>;
  }) {
    super(context);
    this.responseSchema = context.responseSchema;
  }

  /**
   * Validates term items when a schema is configured.
   */
  private async validate<T>(value: unknown): Promise<T> {
    if (!this.responseSchema) {
      return value as T;
    }

    const { validateWithStandardSchema } = await import('../core/validation.js');
    // @ts-ignore - Schema type complexity
    return validateWithStandardSchema(this.responseSchema, value, 'Term response validation failed');
  }

  /**
   * Validates a term collection.
   */
  private async validateCollection<T>(values: unknown[]): Promise<T[]> {
    if (!this.responseSchema) {
      return values as T[];
    }

    return Promise.all(values.map((value) => this.validate<T>(value)));
  }

  /**
   * Lists terms with optional validation.
   */
  async listWithValidation(
    filter: QueryParams & PaginationParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    const items = await this.list(filter, options);
    return this.validateCollection<TTerm>(items as unknown[]);
  }

  /**
   * Lists every page of terms with optional validation.
   */
  async listAllWithValidation(
    filter: Omit<QueryParams & PaginationParams, 'page'> = {},
    options?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    const items = await this.listAll(filter, options);
    return this.validateCollection<TTerm>(items as unknown[]);
  }

  /**
   * Lists one page of terms with pagination metadata and optional validation.
   */
  async listPaginatedWithValidation(
    filter: QueryParams & PaginationParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TTerm>> {
    const result = await this.listPaginated(filter, options);

    return {
      ...result,
      data: await this.validateCollection<TTerm>(result.data as unknown[]),
    };
  }

  /**
   * Gets single term by ID with optional validation.
   */
  async getWithValidation(
    id: number,
    options?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    const item = await this.getById(id, options);
    return this.validate<TTerm>(item as unknown);
  }

  /**
   * Gets single term by slug with optional validation.
   */
  async getBySlugWithValidation(
    slug: string,
    options?: WordPressRequestOverrides,
  ): Promise<TTerm | undefined> {
    const item = await this.getBySlug(slug, options);

    if (item === undefined) {
      return undefined;
    }

    return this.validate<TTerm>(item as unknown);
  }
}

/**
 * Registry for managing generic content and term resources.
 * Caches resource instances by name to avoid repeated instantiation.
 */
export class GenericResourceRegistry {
  private readonly context: GenericResourceContext;
  private readonly contentCache = new Map<string, GenericContentResource>();
  private readonly termCache = new Map<string, GenericTermResource>();

  constructor(context: GenericResourceContext) {
    this.context = context;
  }

  /**
   * Gets or creates a generic content resource client.
   */
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, WordPressWritePayload, WordPressWritePayload> {
    // For schema-backed resources, create a new instance each time to avoid cache collisions
    // between different schemas. Only cache raw resources (no schema).
    const cacheKey = responseSchema 
      ? null  // Don't cache schema-backed resources
      : `${resource}:raw`;

    let baseResource: GenericContentResource<TResource> | undefined;
    
    if (cacheKey) {
      baseResource = this.contentCache.get(cacheKey) as GenericContentResource<TResource> | undefined;
    }

    if (!baseResource) {
      // @ts-ignore - Type complexity at generic boundaries
      baseResource = new GenericContentResource<TResource>({
        runtime: this.context.runtime,
        endpoint: `/${resource}`,
        missingRawMessage: `Raw ${resource} content is unavailable. The current credentials may not have edit capabilities.`,
        responseSchema: responseSchema as WordPressStandardSchema<WordPressPostLike>,
      } as any);
      // Only cache raw resources (no schema) to avoid schema collisions
      if (cacheKey) {
        this.contentCache.set(cacheKey, baseResource as GenericContentResource);
      }
    }

    const client = this.createContentClient(baseResource, responseSchema);
    return client as ContentResourceClient<TResource, WordPressWritePayload, WordPressWritePayload>;
  }

  /**
   * Creates a typed content client from a generic resource.
   */
  private createContentClient<TResource extends WordPressPostLike>(
    resource: GenericContentResource<TResource>,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, WordPressWritePayload, WordPressWritePayload> {
    const validateContent = async (value: TResource): Promise<TResource> => {
      if (!responseSchema) {
        return value;
      }

      const { validateWithStandardSchema } = await import('../core/validation.js');
      return validateWithStandardSchema(
        responseSchema,
        value,
        'Content response validation failed',
      );
    };

    const createRelationQuery = <TRelations extends readonly AllPostRelations[]>(
      idOrSlug: number | string,
      relations: TRelations,
    ): PostRelationQueryBuilder<TRelations, TResource> => new PostRelationQueryBuilder<TRelations, TResource>(
      this.context.relationClient,
      typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
      (id) => resource.getByIdAsQuery(id),
      (slug) => resource.getBySlugAsQuery(slug),
      relations,
      validateContent,
    );

    return {
      list: async (filter = {}, options) => {
        const items = await resource.listWithValidation(filter, options);
        return items as TResource[];
      },
      listAll: async (filter = {}, options) => {
        const allItems = await resource.listAllWithValidation(
          filter as Omit<QueryParams & PaginationParams, 'page'>,
          options,
        );
        return allItems as TResource[];
      },
      listPaginated: async (filter = {}, options) => {
        const result = await resource.listPaginatedWithValidation(
          filter as QueryParams & PaginationParams,
          options,
        );
        return result as PaginatedResponse<TResource>;
      },
      getById: async (id, options) => {
        const item = await resource.getWithValidation(id, options);
        return item as TResource;
      },
      getBySlug: async (slug, options) => {
        const item = await resource.getBySlugWithValidation(slug, options);
        return item as TResource | undefined;
      },
      item: (idOrSlug: number | string) => createRelationQuery(idOrSlug, []),
      getWithRelations: async <TRelations extends readonly AllPostRelations[]>(
        idOrSlug: number | string,
        ...relations: TRelations
      ): Promise<TResource & { related: SelectedPostRelations<TRelations> }> => {
        const query = createRelationQuery(idOrSlug, relations);
        const result = await query.get();
        return result as TResource & { related: SelectedPostRelations<TRelations> };
      },
      create: (input, options) => resource.create(input, responseSchema as WordPressStandardSchema<TResource>, options),
      update: (id, input, options) => resource.update(id, input, responseSchema as WordPressStandardSchema<TResource>, options),
      delete: (id, options) => resource.delete(id, options),
    };
  }

  /**
   * Gets or creates a generic term resource client.
   */
  terms<TTerm = WordPressCategory>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TTerm>,
  ): TermsResourceClient<TTerm, TermWriteInput, TermWriteInput> {
    const cacheKey = responseSchema
      ? null
      : `${resource}:raw`;

    let baseResource: GenericTermResource<TTerm> | undefined;

    if (cacheKey) {
      baseResource = this.termCache.get(cacheKey) as GenericTermResource<TTerm> | undefined;
    }

    if (!baseResource) {
      baseResource = new GenericTermResource<TTerm>({
        runtime: this.context.runtime,
        endpoint: `/${resource}`,
        responseSchema,
      });

      if (cacheKey) {
        this.termCache.set(cacheKey, baseResource as GenericTermResource);
      }
    }

    return {
      list: (filter = {}, options) => baseResource.listWithValidation(filter as QueryParams & PaginationParams, options) as Promise<TTerm[]>,
      listAll: (filter = {}, options) => baseResource.listAllWithValidation(filter as Omit<QueryParams & PaginationParams, 'page'>, options) as Promise<TTerm[]>,
      listPaginated: (filter = {}, options) => baseResource.listPaginatedWithValidation(filter as QueryParams & PaginationParams, options) as Promise<PaginatedResponse<TTerm>>,
      getById: (id, options) => baseResource.getWithValidation(id, options) as Promise<TTerm>,
      getBySlug: (slug, options) => baseResource.getBySlugWithValidation(slug, options) as Promise<TTerm | undefined>,
      create: (input, options) => baseResource.create(input, responseSchema, options) as Promise<TTerm>,
      update: (id, input, options) => baseResource.update(id, input, responseSchema, options) as Promise<TTerm>,
      delete: (id, options) => baseResource.delete(id, options),
    };
  }
}

// Re-export types that consumers might need
export type { ContentResourceClient, TermsResourceClient };
