import type { WordPressAuthor } from '../schemas.js';
import type {
  PaginatedResponse,
  UsersResourceClient,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { UsersFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { UserDeleteOptions, UserWriteInput } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { authorSchema } from '../standard-schemas.js';
import { BaseCrudResource } from '../core/resource-base.js';
import { normalizeDeleteResult } from '../core/params.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import { throwIfWordPressError } from '../core/errors.js';
import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import type { PostRelationClient } from '../builders/relation-contracts.js';
import { resolveMutationSchema } from '../core/mutation-helpers.js';
import { createSchemaValidators, shouldSkipValidation } from './schema-validation.js';

/**
 * WordPress users resource with CRUD support and `/me` access.
 */
export class UsersResource extends BaseCrudResource<
  WordPressAuthor,
  ExtensibleFilter<UsersFilter>,
  UserWriteInput,
  UserWriteInput
> {
  /**
   * Creates a users resource instance.
   */
  static create(runtime: WordPressRuntime): UsersResource {
    return new UsersResource({
      runtime,
      endpoint: '/users',
      defaultSchema: authorSchema,
    });
  }

  /**
   * Gets the current authenticated user.
   */
  async me(requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    if (!this.runtime.hasAuth()) {
      throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
    }

    return this.runtime.fetchAPI<WordPressAuthor>('/users/me', undefined, requestOptions);
  }

  /**
   * Deletes a user with optional reassignment behavior.
   */
  override async delete(
    id: number,
    options: WordPressRequestOverrides & UserDeleteOptions = {},
  ) {
    const params: Record<string, string> = {};

    if (options.force) {
      params.force = 'true';
    }

    if (typeof options.reassign === 'number') {
      params.reassign = String(options.reassign);
    }

    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: `${this.endpoint}/${id}`,
      method: 'DELETE',
      params: Object.keys(params).length > 0 ? params : undefined,
    }, options));

    throwIfWordPressError(response, data);
    return normalizeDeleteResult(id, data);
  }
}

/**
 * Creates a typed users client with optional read and mutation validation.
 */
export function createUsersClient<TResource extends WordPressAuthor = WordPressAuthor>(
  resource: UsersResource,
  relationClient: PostRelationClient,
  responseSchema?: WordPressStandardSchema<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): UsersResourceClient<TResource, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput> {
  const hasExplicitResponseSchema = responseSchema !== undefined;
  const validators = createSchemaValidators(
    (responseSchema ?? authorSchema) as WordPressStandardSchema<TResource>,
    'User response validation failed',
  );

  /**
   * Gets one user by numeric ID or slug.
   */
  const loadUser = async (
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ) => {
    const item = typeof idOrSlug === 'number'
      ? await resource.getById(idOrSlug, options)
      : await resource.getBySlug(idOrSlug, options);

    if (item === undefined) {
      return undefined;
    }

    return validators.validate(item as unknown);
  };

  const item = ((
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ) => new ResourceItemQueryBuilder(
    relationClient,
    () => loadUser(idOrSlug, options),
    new Set<string>(),
    async () => ({}),
  )) as UsersResourceClient<TResource, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput>['item'];

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
    me: async (options) => validators.validate(await resource.me(options) as unknown),
    create: <TResponse = TResource>(
      input: UserWriteInput,
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
      input: UserWriteInput,
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
