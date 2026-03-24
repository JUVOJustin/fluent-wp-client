import type { WordPressCategory } from '../schemas.js';
import type { WordPressRequestOverrides, PaginatedResponse } from '../types/resources.js';
import type { CategoriesFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { TermWriteInput } from '../types/payloads.js';
import { categorySchema } from '../standard-schemas.js';
import { BaseCrudResource } from '../core/resource-base.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress categories resource with full CRUD support.
 * 
 * @example
 * ```typescript
 * const categories = CategoriesResource.create(runtime);
 * const allCategories = await categories.getCategories();
 * const category = await categories.getCategory(123);
 * ```
 */
export class CategoriesResource extends BaseCrudResource<
  WordPressCategory,
  ExtensibleFilter<CategoriesFilter>,
  TermWriteInput,
  TermWriteInput
> {
  /**
   * Creates a categories resource instance.
   */
  static create(runtime: WordPressRuntime): CategoriesResource {
    return new CategoriesResource({
      runtime,
      endpoint: '/categories',
      defaultSchema: categorySchema,
    });
  }

  /**
   * Alias for list() - gets categories matching filter.
   */
  getCategories(filter?: ExtensibleFilter<CategoriesFilter>, options?: WordPressRequestOverrides): Promise<WordPressCategory[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all categories via pagination.
   */
  getAllCategories(
    filter?: Omit<ExtensibleFilter<CategoriesFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressCategory[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets categories with pagination metadata.
   */
  getCategoriesPaginated(
    filter?: ExtensibleFilter<CategoriesFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressCategory>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getById() - gets category by ID.
   */
  getCategory(id: number, options?: WordPressRequestOverrides): Promise<WordPressCategory> {
    return this.getById(id, options);
  }

  /**
   * Alias for getBySlug() - gets category by slug.
   */
  getCategoryBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressCategory | undefined> {
    return this.getBySlug(slug, options);
  }
}
