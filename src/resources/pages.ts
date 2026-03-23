import type { WordPressBlockParser } from '../blocks.js';
import type { WordPressPage, WordPressPostWriteBase } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { ExtensibleFilter, FetchResult, SerializedQueryParams } from '../types/resources.js';
import type { PagesFilter } from '../types/filters.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { pageSchema } from '../standard-schemas.js';
import {
  createPostLikeResourceFactory,
  createCollectionCrudFactory,
  type ResourceDependencies,
  type CrudMethods,
} from '../core/resource-factories.js';

const missingRawPageMessage =
  'Raw page content is unavailable. The current credentials may not have edit capabilities for this page.';

/**
 * Page methods including read operations and CRUD.
 */
export interface PageMethods extends CrudMethods<WordPressPage, WordPressPostWriteBase> {
  getPages: (filter?: ExtensibleFilter<PagesFilter>, options?: WordPressRequestOverrides) => Promise<WordPressPage[]>;
  getAllPages: (filter?: Omit<ExtensibleFilter<PagesFilter>, 'page'>, options?: WordPressRequestOverrides) => Promise<WordPressPage[]>;
  getPagesPaginated: (filter?: ExtensibleFilter<PagesFilter>, options?: WordPressRequestOverrides) => Promise<import('../types/resources.js').PaginatedResponse<WordPressPage>>;
  getPage: (id: number, options?: WordPressRequestOverrides) => import('../content-query.js').WordPressContentQuery<WordPressPage>;
  getPageBySlug: (slug: string, options?: WordPressRequestOverrides) => import('../content-query.js').WordPressContentQuery<WordPressPage | undefined>;
}

/**
 * Creates all page resource methods (read + CRUD).
 */
export function createPagesResource(
  deps: ResourceDependencies,
  defaultBlockParser?: WordPressBlockParser,
): PageMethods {
  const readCore = createPostLikeResourceFactory<WordPressPage, ExtensibleFilter<PagesFilter>>('pages', missingRawPageMessage)(
    deps.fetchAPI,
    deps.fetchAPIPaginated,
    defaultBlockParser,
  );

  const crudCore = createCollectionCrudFactory<WordPressPage, WordPressPostWriteBase>('/pages', pageSchema as WordPressStandardSchema<WordPressPage>)(deps);

  return {
    getPages: readCore.list,
    getAllPages: readCore.listAll,
    getPagesPaginated: readCore.listPaginated,
    getPage: readCore.getById,
    getPageBySlug: readCore.getBySlug,
    create: crudCore.create,
    update: crudCore.update,
    delete: crudCore.delete,
  };
}
