import type { WordPressCategory } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams } from '../types/resources.js';
import type { TermWriteInput } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { categorySchema } from '../standard-schemas.js';
import {
  createCollectionResourceFactory,
  createCollectionCrudFactory,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';

/**
 * Category methods including read operations and CRUD.
 */
export interface CategoryMethods extends CrudMethods<WordPressCategory, TermWriteInput> {
  getCategories: (filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides) => Promise<WordPressCategory[]>;
  getAllCategories: (filter?: Omit<ExtensibleFilter<CategoriesFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressCategory[]>;
  getCategoriesPaginated: (filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressCategory>>;
  getCategory: (id: number, options?: WordPressRequestOverrides) => Promise<WordPressCategory>;
  getCategoryBySlug: (slug: string, options?: WordPressRequestOverrides) => Promise<WordPressCategory | undefined>;
}

/**
 * Creates all category resource methods (read + CRUD).
 */
export function createCategoriesResource(deps: ResourceDependencies): CategoryMethods {
  const readCore = createCollectionResourceFactory<WordPressCategory, ExtensibleFilter<CategoriesFilter>>('/categories')(deps.fetchAPI, deps.fetchAPIPaginated);
  const crudCore = createCollectionCrudFactory<WordPressCategory, TermWriteInput>('/categories', categorySchema as WordPressStandardSchema<WordPressCategory>)(deps);

  return {
    getCategories: readCore.list,
    getAllCategories: readCore.listAll,
    getCategoriesPaginated: readCore.listPaginated,
    getCategory: readCore.getById,
    getCategoryBySlug: readCore.getBySlug,
    create: crudCore.create,
    update: crudCore.update,
    delete: crudCore.delete,
  };
}
