import type { WordPressStandardSchema } from '../core/validation.js';
import type {
  PaginatedResponse,
  QueryParams,
  WordPressDeleteResult,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { DeleteOptions, WordPressWritePayload } from '../types/payloads.js';
import { resolveMutationSchema, type MutationOptions } from '../core/mutation-helpers.js';

/**
 * Creates reusable read validators for schema-backed resources.
 */
export function createSchemaValidators<T>(
  responseSchema: WordPressStandardSchema<T> | undefined,
  errorMessage: string,
): {
  validate: (value: unknown) => Promise<T>;
  validateCollection: (values: unknown[]) => Promise<T[]>;
} {
  const validate = async (value: unknown): Promise<T> => {
    if (!responseSchema) {
      return value as T;
    }

    const { validateWithStandardSchema } = await import('../core/validation.js');

    return validateWithStandardSchema(responseSchema, value, errorMessage);
  };

  const validateCollection = async (values: unknown[]): Promise<T[]> => {
    if (!responseSchema) {
      return values as T[];
    }

    return Promise.all(values.map((value) => validate(value)));
  };

  return {
    validate,
    validateCollection,
  };
}

/**
 * Determines whether to skip built-in schema validation for field-filtered responses.
 * Used by resource clients to avoid validation errors when fields are explicitly filtered.
 */
export function shouldSkipValidation(
  hasExplicitResponseSchema: boolean,
  filter: QueryParams | undefined,
): boolean {
  return !hasExplicitResponseSchema && filter?.fields !== undefined;
}

/**
 * Minimal interface for a resource that supports list/listAll/listPaginated.
 * Avoids coupling to a specific base class.
 */
interface ListableResource<TResource, TFilter> {
  list(filter: TFilter, options?: WordPressRequestOverrides): Promise<TResource[]>;
  listAll(filter: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides): Promise<TResource[]>;
  listPaginated(filter: TFilter, options?: WordPressRequestOverrides): Promise<PaginatedResponse<TResource>>;
}

/**
 * Creates validated list/listAll/listPaginated wrappers for a resource.
 * Shared across content, terms, media, comments, and users client factories.
 */
export function createValidatedListMethods<TResource, TFilter extends QueryParams>(
  resource: ListableResource<TResource, TFilter>,
  validators: ReturnType<typeof createSchemaValidators<TResource>>,
  hasExplicitResponseSchema: boolean,
) {
  return {
    list: async (
      filter: TFilter = {} as TFilter,
      options?: WordPressRequestOverrides,
    ): Promise<TResource[]> => {
      const items = await resource.list(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listAll: async (
      filter: Omit<TFilter, 'page'> = {} as Omit<TFilter, 'page'>,
      options?: WordPressRequestOverrides,
    ): Promise<TResource[]> => {
      const items = await resource.listAll(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listPaginated: async (
      filter: TFilter = {} as TFilter,
      options?: WordPressRequestOverrides,
    ): Promise<PaginatedResponse<TResource>> => {
      const result = await resource.listPaginated(filter, options);

      if (shouldSkipValidation(hasExplicitResponseSchema, filter)) {
        return result as PaginatedResponse<TResource>;
      }

      return {
        ...result,
        data: await validators.validateCollection(result.data as unknown[]),
      };
    },
  };
}

/**
 * Minimal interface for a resource that supports create/update/delete.
 * Avoids coupling to a specific base class.
 */
interface MutableResource<TCreate extends WordPressWritePayload, TUpdate extends WordPressWritePayload> {
  create<TResponse>(
    input: TCreate,
    mutationOptionsOrResponseSchema?: MutationOptions<TCreate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse>;
  update<TResponse>(
    id: number,
    input: TUpdate,
    mutationOptionsOrResponseSchema?: MutationOptions<TUpdate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TResponse>;
  delete(id: number, options?: DeleteOptions & WordPressRequestOverrides): Promise<WordPressDeleteResult>;
}

/**
 * Creates CRUD client wrappers that layer mutation schema resolution on top of a resource.
 * Shared across content, terms, media, comments, and users client factories.
 *
 * Supports the full `MutationOptions` shape (including `inputSchema`) as the
 * optional second parameter of `create()` and `update()`.
 */
export function createCrudClientMethods<
  TResource,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload,
>(
  resource: MutableResource<TCreate, TUpdate>,
  clientResponseSchema?: WordPressStandardSchema<TResource>,
) {
  return {
    create: <TResponse = TResource>(
      input: TCreate,
      mutationOptionsOrResponseSchema?: MutationOptions<TCreate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        mutationOptionsOrResponseSchema,
        requestOptions,
        clientResponseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      // Pass inputSchema through to the underlying resource so input is validated
      // before the HTTP request. Other resolved fields are forwarded explicitly.
      return resource.create<TResponse>(input, {
        inputSchema: resolved.inputSchema as WordPressStandardSchema<TCreate> | undefined,
        responseSchema: resolved.responseSchema,
        ...resolved.requestOptions,
      });
    },
    update: <TResponse = TResource>(
      id: number,
      input: TUpdate,
      mutationOptionsOrResponseSchema?: MutationOptions<TUpdate, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        mutationOptionsOrResponseSchema,
        requestOptions,
        clientResponseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      // Pass inputSchema through to the underlying resource so input is validated
      // before the HTTP request. Other resolved fields are forwarded explicitly.
      return resource.update<TResponse>(id, input, {
        inputSchema: resolved.inputSchema as WordPressStandardSchema<TUpdate> | undefined,
        responseSchema: resolved.responseSchema,
        ...resolved.requestOptions,
      });
    },
    delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) =>
      resource.delete(id, options),
  };
}
