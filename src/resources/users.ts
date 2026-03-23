import type { WordPressAuthor } from '../schemas.js';
import type { WordPressRequestOverrides, PaginatedResponse } from '../types/resources.js';
import type { UsersFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { UserWriteInput, UserDeleteOptions } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { authorSchema } from '../standard-schemas.js';
import { BaseCrudResource, type ResourceContext } from '../core/resource-base.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress users resource with full CRUD support.
 * 
 * @example
 * ```typescript
 * const users = UsersResource.create(runtime);
 * const allUsers = await users.getUsers();
 * const currentUser = await users.getCurrentUser();
 * ```
 */
export class UsersResource extends BaseCrudResource<
  WordPressAuthor,
  ExtensibleFilter<UsersFilter>,
  UserWriteInput,
  UserWriteInput
> {
  protected override get defaultSchema(): WordPressStandardSchema<WordPressAuthor> | undefined {
    return authorSchema as WordPressStandardSchema<WordPressAuthor>;
  }

  /**
   * Creates a users resource instance.
   */
  static create(runtime: WordPressRuntime): UsersResource {
    return new UsersResource({
      runtime,
      endpoint: '/users',
    });
  }

  /**
   * Alias for list() - gets users matching filter.
   */
  getUsers(filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides): Promise<WordPressAuthor[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all users via pagination.
   */
  getAllUsers(
    filter?: Omit<ExtensibleFilter<UsersFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressAuthor[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets users with pagination metadata.
   */
  getUsersPaginated(
    filter?: ExtensibleFilter<UsersFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressAuthor>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getById() - gets user by ID.
   */
  getUser(id: number, options?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    return this.getById(id, options);
  }

  /**
   * Alias for getBySlug() - gets user by slug.
   */
  getUserBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressAuthor | undefined> {
    return this.getBySlug(slug, options);
  }

  /**
   * Gets the current authenticated user.
   */
  async getCurrentUser(requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor> {
    if (!this.runtime.hasAuth()) {
      throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
    }
    return this.runtime.fetchAPI<WordPressAuthor>('/users/me', undefined, requestOptions);
  }
}

/**
 * Legacy factory function - now delegates to UsersResource.create().
 * @deprecated Use UsersResource.create() or new UsersResource() directly.
 */
export function createUsersResource(runtime: WordPressRuntime): UsersResource {
  return UsersResource.create(runtime);
}

/**
 * @deprecated Import UserMethods from '../types/resources.js' instead.
 */
export interface UserMethods extends UsersResource {}
