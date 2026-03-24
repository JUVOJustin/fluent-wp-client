import type { WordPressPostLike, WordPressCategory } from '../schemas.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type {
  AllPostRelations,
  PostRelationClient,
  SelectedPostRelations,
} from '../builders/relations.js';
import {
  BaseCollectionResource,
  BaseCrudResource,
  BasePostLikeResource,
  type ResourceContext,
  type PostLikeResourceContext,
} from '../core/resource-base.js';
import type {
  ContentResourceClient,
  TermsResourceClient,
  PaginatedResponse,
  PaginationParams,
  WordPressRequestOverrides,
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

  constructor(context: ResourceContext & { responseSchema?: WordPressStandardSchema<TTerm> }) {
    super(context);
    this.responseSchema = context.responseSchema;
  }

  /**
   * No default schema for generic terms.
   */
  protected override get defaultSchema(): WordPressStandardSchema<TTerm> | undefined {
    return undefined;
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
      item: (idOrSlug: number | string) => new PostRelationQueryBuilder(
        this.context.relationClient,
        typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
        (id) => resource.getByIdAsQuery(id),
        (slug) => resource.getBySlugAsQuery(slug),
      ),
      getWithRelations: async <TRelations extends readonly AllPostRelations[]>(
        idOrSlug: number | string,
        ...relations: TRelations
      ): Promise<TResource & { related: SelectedPostRelations<TRelations> }> => {
        const query = new PostRelationQueryBuilder<TRelations, TResource>(
          this.context.relationClient,
          typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
          (id) => resource.getByIdAsQuery(id),
          (slug) => resource.getBySlugAsQuery(slug),
          relations,
        );
        const result = await query.get();
        if (responseSchema) {
          const { validateWithStandardSchema } = await import('../core/validation.js');
          // @ts-ignore - Validation returns Promise, we await it
          return await validateWithStandardSchema(
            responseSchema,
            result,
            'Content with relations validation failed',
          ) as TResource & { related: SelectedPostRelations<TRelations> };
        }
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
    const cacheKey = `${resource}:${responseSchema ? 'schema' : 'raw'}`;

    let baseResource = this.termCache.get(cacheKey) as GenericTermResource<TTerm> | undefined;

    if (!baseResource) {
      baseResource = new GenericTermResource<TTerm>({
        runtime: this.context.runtime,
        endpoint: `/${resource}`,
        responseSchema,
      });
      this.termCache.set(cacheKey, baseResource as GenericTermResource);
    }

    return {
      list: (filter = {}, options) => baseResource.list(filter as QueryParams & PaginationParams, options) as Promise<TTerm[]>,
      listAll: (filter = {}, options) => baseResource.listAll(filter as Omit<QueryParams & PaginationParams, 'page'>, options) as Promise<TTerm[]>,
      listPaginated: (filter = {}, options) => baseResource.listPaginated(filter as QueryParams & PaginationParams, options) as Promise<PaginatedResponse<TTerm>>,
      getById: (id, options) => baseResource.getById(id, options) as Promise<TTerm>,
      getBySlug: (slug, options) => baseResource.getBySlug(slug, options) as Promise<TTerm | undefined>,
      create: (input, options) => baseResource.create(input, responseSchema, options) as Promise<TTerm>,
      update: (id, input, options) => baseResource.update(id, input, responseSchema, options) as Promise<TTerm>,
      delete: (id, options) => baseResource.delete(id, options),
    };
  }

  /**
   * Legacy method - gets content collection directly.
   * @deprecated Use content().list() instead.
   */
  async getContentCollection<TContent = WordPressPostLike>(
    resource: string,
    filter: QueryParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    return this.content(resource).list(filter, requestOptions) as Promise<TContent[]>;
  }

  /**
   * Legacy method - gets all content.
   * @deprecated Use content().listAll() instead.
   */
  async getAllContentCollection<TContent = WordPressPostLike>(
    resource: string,
    filter: Omit<QueryParams, 'page'> = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    return this.content(resource).listAll(filter, requestOptions) as Promise<TContent[]>;
  }

  /**
   * Legacy method - gets content paginated.
   * @deprecated Use content().listPaginated() instead.
   */
  async getContentCollectionPaginated<TContent = WordPressPostLike>(
    resource: string,
    filter: QueryParams & PaginationParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TContent>> {
    return this.content(resource).listPaginated(filter, requestOptions) as Promise<PaginatedResponse<TContent>>;
  }

  /**
   * Legacy method - gets single content item.
   * @deprecated Use content().getById() instead.
   */
  async getContent<TContent = WordPressPostLike>(
    resource: string,
    id: number,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent> {
    return this.content(resource).getById(id, requestOptions) as Promise<TContent>;
  }

  /**
   * Legacy method - gets content by slug.
   * @deprecated Use content().getBySlug() instead.
   */
  async getContentBySlug<TContent = WordPressPostLike>(
    resource: string,
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent | undefined> {
    return this.content(resource).getBySlug(slug, requestOptions) as Promise<TContent | undefined>;
  }

  /**
   * Legacy method - creates content.
   * @deprecated Use content().create() instead.
   */
  async createContent<TContent = WordPressPostLike>(
    resource: string,
    input: WordPressWritePayload,
    responseSchema?: WordPressStandardSchema<TContent>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent> {
    // @ts-ignore - Schema type variance
    return this.content(resource, responseSchema as any).create(input, requestOptions) as Promise<TContent>;
  }

  /**
   * Legacy method - updates content.
   * @deprecated Use content().update() instead.
   */
  async updateContent<TContent = WordPressPostLike>(
    resource: string,
    id: number,
    input: WordPressWritePayload,
    responseSchema?: WordPressStandardSchema<TContent>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent> {
    return this.content(resource, 
      // @ts-ignore - Schema type variance
      responseSchema as any
    ).update(id, input, requestOptions) as Promise<TContent>;
  }

  /**
   * Legacy method - deletes content.
   * @deprecated Use content().delete() instead.
   */
  async deleteContent(
    resource: string,
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<{ id: number; deleted: boolean; previous?: unknown }> {
    return this.content(resource).delete(id, options);
  }

  /**
   * Legacy method - gets term collection.
   * @deprecated Use terms().list() instead.
   */
  async getTermCollection<TTerm = WordPressCategory>(
    resource: string,
    filter: QueryParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    return this.terms(resource).list(filter, requestOptions) as Promise<TTerm[]>;
  }

  /**
   * Legacy method - gets all terms.
   * @deprecated Use terms().listAll() instead.
   */
  async getAllTermCollection<TTerm = WordPressCategory>(
    resource: string,
    filter: Omit<QueryParams, 'page'> = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    return this.terms(resource).listAll(filter, requestOptions) as Promise<TTerm[]>;
  }

  /**
   * Legacy method - gets terms paginated.
   * @deprecated Use terms().listPaginated() instead.
   */
  async getTermCollectionPaginated<TTerm = WordPressCategory>(
    resource: string,
    filter: QueryParams & PaginationParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TTerm>> {
    return this.terms(resource).listPaginated(filter, requestOptions) as Promise<PaginatedResponse<TTerm>>;
  }

  /**
   * Legacy method - gets single term.
   * @deprecated Use terms().getById() instead.
   */
  async getTerm<TTerm = WordPressCategory>(
    resource: string,
    id: number,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    return this.terms(resource).getById(id, requestOptions) as Promise<TTerm>;
  }

  /**
   * Legacy method - gets term by slug.
   * @deprecated Use terms().getBySlug() instead.
   */
  async getTermBySlug<TTerm = WordPressCategory>(
    resource: string,
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm | undefined> {
    return this.terms(resource).getBySlug(slug, requestOptions) as Promise<TTerm | undefined>;
  }

  /**
   * Legacy method - creates term.
   * @deprecated Use terms().create() instead.
   */
  async createTerm<TTerm = WordPressCategory>(
    resource: string,
    input: TermWriteInput,
    responseSchema?: WordPressStandardSchema<TTerm>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    return this.terms(resource, responseSchema).create(input, requestOptions) as Promise<TTerm>;
  }

  /**
   * Legacy method - updates term.
   * @deprecated Use terms().update() instead.
   */
  async updateTerm<TTerm = WordPressCategory>(
    resource: string,
    id: number,
    input: TermWriteInput,
    responseSchema?: WordPressStandardSchema<TTerm>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    return this.terms(resource, responseSchema).update(id, input, requestOptions) as Promise<TTerm>;
  }

  /**
   * Legacy method - deletes term.
   * @deprecated Use terms().delete() instead.
   */
  async deleteTerm(
    resource: string,
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<{ id: number; deleted: boolean; previous?: unknown }> {
    return this.terms(resource).delete(id, options);
  }
}

/**
 * Legacy factory function - creates a registry.
 * @deprecated Use GenericResourceRegistry directly.
 */
export function createContentTermMethods(context: GenericResourceContext): GenericResourceRegistry {
  return new GenericResourceRegistry(context);
}

// Type alias for backward compatibility
export type ContentTermMethodDependencies = GenericResourceContext;

// Re-export types that consumers might need
export type { ContentResourceClient, TermsResourceClient };
