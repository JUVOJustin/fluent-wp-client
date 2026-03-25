import type { WordPressComment } from '../schemas.js';
import type {
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
import { resolveMutationArguments } from '../core/mutation-helpers.js';
import { createSchemaValidators } from './schema-validation.js';

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
  responseSchema?: WordPressStandardSchema<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): CommentsResourceClient<TResource, ExtensibleFilter<CommentsFilter>, WordPressWritePayload, WordPressWritePayload> {
  const hasExplicitResponseSchema = responseSchema !== undefined;
  const validators = createSchemaValidators(
    (responseSchema ?? commentSchema) as WordPressStandardSchema<TResource>,
    'Comment response validation failed',
  );

  /**
   * Skips built-in validation for field-filtered list responses.
   */
  function shouldSkipValidation(filter: ExtensibleFilter<CommentsFilter> | undefined): boolean {
    return !hasExplicitResponseSchema && filter?.fields !== undefined;
  }

  /**
   * Resolves the effective mutation schema for this client call.
   */
  function resolveMutationSchema<TResponse>(
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): {
    requestOptions?: WordPressRequestOverrides;
    responseSchema?: WordPressStandardSchema<TResponse>;
  } {
    const resolved = resolveMutationArguments<TResponse>(
      responseSchemaOrRequestOptions,
      requestOptions,
    );

    return {
      requestOptions: resolved.requestOptions,
      responseSchema: resolved.responseSchema
        ?? (responseSchema as WordPressStandardSchema<TResponse> | undefined),
    };
  }

  return {
    list: async (filter = {}, options) => {
      const items = await resource.list(filter, options);

      if (shouldSkipValidation(filter)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listAll: async (filter = {}, options) => {
      const items = await resource.listAll(filter, options);

      if (shouldSkipValidation(filter as ExtensibleFilter<CommentsFilter> | undefined)) {
        return items as TResource[];
      }

      return validators.validateCollection(items as unknown[]);
    },
    listPaginated: async (filter = {}, options) => {
      const result = await resource.listPaginated(filter, options);

      if (shouldSkipValidation(filter)) {
        return result as PaginatedResponse<TResource>;
      }

      return {
        ...result,
        data: await validators.validateCollection(result.data as unknown[]),
      };
    },
    get: async (id, options) => validators.validate(await resource.getById(id, options) as unknown),
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
