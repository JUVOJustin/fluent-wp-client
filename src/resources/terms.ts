import { BaseCrudResource } from '../core/resource-base.js';
import { resolveMutationSchema } from '../core/mutation-helpers.js';
import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type { WordPressCategory, WordPressTag } from '../schemas.js';
import { categorySchema, tagSchema } from '../standard-schemas.js';
import type {
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  TermsResourceClient,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { TermWriteInput, WordPressWritePayload } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { createSchemaValidators } from './schema-validation.js';

/**
 * Built-in defaults for known term resources.
 */
export const knownTermDefaults = {
  categories: {
    defaultSchema: categorySchema,
  },
  tags: {
    defaultSchema: tagSchema,
  },
} as const satisfies Record<string, {
  defaultSchema: WordPressStandardSchema<WordPressCategory | WordPressTag>;
}>;

/**
 * Generic term resource for custom taxonomies.
 */
export class GenericTermResource<
  TTerm = WordPressCategory,
  TCreate extends WordPressWritePayload = TermWriteInput,
  TUpdate extends WordPressWritePayload = TCreate,
> extends BaseCrudResource<TTerm, QueryParams & PaginationParams, TCreate, TUpdate> {
  private readonly hasExplicitResponseSchema: boolean;
  private readonly validators: ReturnType<typeof createSchemaValidators<TTerm>>;

  constructor(context: {
    runtime: WordPressRuntime;
    endpoint: string;
    defaultSchema?: WordPressStandardSchema<TTerm>;
    responseSchema?: WordPressStandardSchema<TTerm>;
  }) {
    super(context);
    this.hasExplicitResponseSchema = context.responseSchema !== undefined;
    this.validators = createSchemaValidators(
      (context.responseSchema ?? context.defaultSchema) as WordPressStandardSchema<TTerm> | undefined,
      'Term response validation failed',
    );
  }

  /**
   * Skips built-in schema validation for field-filtered list responses.
   */
  private shouldSkipValidation(filter: QueryParams | undefined): boolean {
    return !this.hasExplicitResponseSchema && filter?.fields !== undefined;
  }

  /**
   * Lists terms with optional validation.
   */
  async listWithValidation(
    filter: QueryParams & PaginationParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    const items = await this.list(filter, options);

    if (this.shouldSkipValidation(filter)) {
      return items as TTerm[];
    }

    return this.validators.validateCollection(items as unknown[]);
  }

  /**
   * Lists every page of terms with optional validation.
   */
  async listAllWithValidation(
    filter: Omit<QueryParams & PaginationParams, 'page'> = {},
    options?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    const items = await this.listAll(filter, options);

    if (this.shouldSkipValidation(filter)) {
      return items as TTerm[];
    }

    return this.validators.validateCollection(items as unknown[]);
  }

  /**
   * Lists one page of terms with pagination metadata and optional validation.
   */
  async listPaginatedWithValidation(
    filter: QueryParams & PaginationParams = {},
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TTerm>> {
    const result = await this.listPaginated(filter, options);

    if (this.shouldSkipValidation(filter)) {
      return result as PaginatedResponse<TTerm>;
    }

    return {
      ...result,
      data: await this.validators.validateCollection(result.data as unknown[]),
    };
  }

  /**
   * Gets one term by ID or slug with optional validation.
   */
  async item(
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ): Promise<TTerm | undefined> {
    const item = typeof idOrSlug === 'number'
      ? await this.getById(idOrSlug, options)
      : await this.getBySlug(idOrSlug, options);

    if (item === undefined) {
      return undefined;
    }

    return this.validators.validate(item as unknown);
  }
}

/**
 * Creates a typed term client from one generic taxonomy resource.
 */
export function createTermsClient<TTerm>(
  resource: GenericTermResource<TTerm>,
  responseSchema?: WordPressStandardSchema<TTerm>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): TermsResourceClient<TTerm, QueryParams & PaginationParams, TermWriteInput, TermWriteInput> {
  const resolveLocalMutationSchema = <TResponse>(
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => resolveMutationSchema(
    responseSchemaOrRequestOptions,
    requestOptions,
    responseSchema as WordPressStandardSchema<TResponse> | undefined,
  );

  return {
    list: (filter = {}, options) => resource.listWithValidation(filter as QueryParams & PaginationParams, options) as Promise<TTerm[]>,
    listAll: (filter = {}, options) => resource.listAllWithValidation(filter as Omit<QueryParams & PaginationParams, 'page'>, options) as Promise<TTerm[]>,
    listPaginated: (filter = {}, options) => resource.listPaginatedWithValidation(filter as QueryParams & PaginationParams, options) as Promise<PaginatedResponse<TTerm>>,
    item: (idOrSlug, options) => resource.item(idOrSlug, options) as Promise<TTerm | undefined>,
    create: <TResponse = TTerm>(
      input: TermWriteInput,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveLocalMutationSchema(
        responseSchemaOrRequestOptions,
        requestOptions,
      );

      return resource.create<TResponse>(
        input,
        resolved.responseSchema as WordPressStandardSchema<TResponse> | undefined,
        resolved.requestOptions,
      );
    },
    update: <TResponse = TTerm>(
      id: number,
      input: TermWriteInput,
      responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveLocalMutationSchema(
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
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
