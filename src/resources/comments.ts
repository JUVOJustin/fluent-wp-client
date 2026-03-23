import type { WordPressComment } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { CommentsFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams } from '../types/resources.js';
import type { WordPressWritePayload } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { commentSchema } from '../standard-schemas.js';
import {
  createCollectionResourceFactory,
  createCollectionCrudFactory,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';

/**
 * Comment methods including read operations and CRUD.
 */
export interface CommentMethods extends CrudMethods<WordPressComment, WordPressWritePayload> {
  getComments: (filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides) => Promise<WordPressComment[]>;
  getAllComments: (filter?: Omit<ExtensibleFilter<CommentsFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressComment[]>;
  getCommentsPaginated: (filter?: ExtensibleFilter<CommentsFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressComment>>;
  getComment: (id: number, options?: WordPressRequestOverrides) => Promise<WordPressComment>;
}

/**
 * Creates all comment resource methods (read + CRUD).
 */
export function createCommentsResource(deps: ResourceDependencies): CommentMethods {
  const readCore = createCollectionResourceFactory<WordPressComment, ExtensibleFilter<CommentsFilter>>('/comments')(deps.fetchAPI, deps.fetchAPIPaginated);
  const crudCore = createCollectionCrudFactory<WordPressComment, WordPressWritePayload>('/comments', commentSchema as WordPressStandardSchema<WordPressComment>)(deps);

  return {
    getComments: readCore.list,
    getAllComments: readCore.listAll,
    getCommentsPaginated: readCore.listPaginated,
    getComment: readCore.getById,
    create: crudCore.create,
    update: crudCore.update,
    delete: crudCore.delete,
  };
}
