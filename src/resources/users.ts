import type { WordPressAuthor } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { UsersFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams } from '../types/resources.js';
import type { UserWriteInput } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { authorSchema } from '../standard-schemas.js';
import {
  createCollectionResourceFactory,
  createCollectionCrudFactory,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';

/**
 * User methods including read operations and CRUD.
 */
export interface UserMethods extends CrudMethods<WordPressAuthor, UserWriteInput> {
  getUsers: (filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides) => Promise<WordPressAuthor[]>;
  getAllUsers: (filter?: Omit<ExtensibleFilter<UsersFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressAuthor[]>;
  getUsersPaginated: (filter?: ExtensibleFilter<UsersFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressAuthor>>;
  getUser: (id: number, options?: WordPressRequestOverrides) => Promise<WordPressAuthor>;
  getUserBySlug: (slug: string, options?: WordPressRequestOverrides) => Promise<WordPressAuthor | undefined>;
  getCurrentUser: (requestOptions?: WordPressRequestOverrides) => Promise<WordPressAuthor>;
}

/**
 * Creates all user resource methods (read + CRUD).
 */
export function createUsersResource(deps: ResourceDependencies, hasAuth: () => boolean): UserMethods {
  const readCore = createCollectionResourceFactory<WordPressAuthor, ExtensibleFilter<UsersFilter>>('/users')(deps.fetchAPI, deps.fetchAPIPaginated);
  const crudCore = createCollectionCrudFactory<WordPressAuthor, UserWriteInput>('/users', authorSchema as WordPressStandardSchema<WordPressAuthor>)(deps);

  return {
    getUsers: readCore.list,
    getAllUsers: readCore.listAll,
    getUsersPaginated: readCore.listPaginated,
    getUser: readCore.getById,
    getUserBySlug: readCore.getBySlug,
    
    async getCurrentUser(requestOptions?: WordPressRequestOverrides): Promise<WordPressAuthor> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /users/me endpoint. Configure auth in client options.');
      }
      return deps.fetchAPI<WordPressAuthor>('/users/me', undefined, requestOptions);
    },

    create: crudCore.create,
    update: crudCore.update,
    delete: crudCore.delete,
  };
}
