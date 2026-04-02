import type { WordPressAuthor } from '../schemas.js';
import type {
  UsersResourceClient,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { UsersFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { UserDeleteOptions, UserWriteInput } from '../types/payloads.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { BaseCrudResource } from '../core/resource-base.js';
import { normalizeDeleteResult } from '../core/params.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import { throwIfWordPressError } from '../core/errors.js';
import type { WordPressRuntime } from '../core/transport.js';
import { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import type { PostRelationClient } from '../builders/relation-contracts.js';

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
    return new UsersResource({ runtime, endpoint: '/users' });
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
 * Creates a typed users client.
 */
export function createUsersClient(
  resource: UsersResource,
  relationClient: PostRelationClient,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): UsersResourceClient<WordPressAuthor, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput> {
  const item = ((
    idOrSlug: number | string,
    options?: WordPressRequestOverrides,
  ) => new ResourceItemQueryBuilder(
    relationClient,
    async () => {
      return typeof idOrSlug === 'number'
        ? resource.getById(idOrSlug, options)
        : resource.getBySlug(idOrSlug, options);
    },
    new Set<string>(),
    async () => ({}),
  )) as UsersResourceClient<WordPressAuthor, ExtensibleFilter<UsersFilter>, UserWriteInput, UserWriteInput>['item'];

  return {
    list: (filter = {}, options) => resource.list(filter, options),
    listAll: (filter = {}, options, listOptions) => resource.listAll(filter, options, listOptions),
    listPaginated: (filter = {}, options) => resource.listPaginated(filter, options),
    create: (input, options) => resource.create(input, options),
    update: (id, input, options) => resource.update(id, input, options),
    delete: (id, options) => resource.delete(id, options),
    item,
    me: (options) => resource.me(options),
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
