import type { WordPressTag } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { TagsFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams } from '../types/resources.js';
import type { TermWriteInput } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { tagSchema } from '../standard-schemas.js';
import {
  createCollectionResourceFactory,
  createCollectionCrudFactory,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';

/**
 * Tag methods including read operations and CRUD.
 */
export interface TagMethods extends CrudMethods<WordPressTag, TermWriteInput> {
  getTags: (filter?: ExtensibleFilter<TagsFilter>, options?: WordPressRequestOverrides) => Promise<WordPressTag[]>;
  getAllTags: (filter?: Omit<ExtensibleFilter<TagsFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressTag[]>;
  getTagsPaginated: (filter?: ExtensibleFilter<TagsFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressTag>>;
  getTag: (id: number, options?: WordPressRequestOverrides) => Promise<WordPressTag>;
  getTagBySlug: (slug: string, options?: WordPressRequestOverrides) => Promise<WordPressTag | undefined>;
}

/**
 * Creates all tag resource methods (read + CRUD).
 */
export function createTagsResource(deps: ResourceDependencies): TagMethods {
  const readCore = createCollectionResourceFactory<WordPressTag, ExtensibleFilter<TagsFilter>>('/tags')(deps.fetchAPI, deps.fetchAPIPaginated);
  const crudCore = createCollectionCrudFactory<WordPressTag, TermWriteInput>('/tags', tagSchema as WordPressStandardSchema<WordPressTag>)(deps);

  return {
    getTags: readCore.list,
    getAllTags: readCore.listAll,
    getTagsPaginated: readCore.listPaginated,
    getTag: readCore.getById,
    getTagBySlug: readCore.getBySlug,
    create: crudCore.create,
    update: crudCore.update,
    delete: crudCore.delete,
  };
}
