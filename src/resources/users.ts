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
import {
  createSchemaValidators,
  createValidatedListMethods,
  createCrudClientMethods,
} from './schema-validation.js';

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

  const listMethods = createValidatedListMethods(
    resource as unknown as Parameters<typeof createValidatedListMethods<TResource, ExtensibleFilter<UsersFilter>>>[0],
    validators,
    hasExplicitResponseSchema,
  );
  const { create, update } = createCrudClientMethods<TResource, UserWriteInput, UserWriteInput>(
    resource as unknown as Parameters<typeof createCrudClientMethods<TResource, UserWriteInput, UserWriteInput>>[0],
    responseSchema,
  );

  return {
    ...listMethods,
    create,
    update,
    delete: (id: number, options?: UserDeleteOptions & WordPressRequestOverrides) => resource.delete(id, options),
    item,
    me: async (options) => validators.validate(await resource.me(options) as unknown),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
