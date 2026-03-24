import type { WordPressBlockParser } from '../blocks.js';
import type { WordPressPage, WordPressPostWriteBase } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { ExtensibleFilter, PaginatedResponse } from '../types/resources.js';
import type { PagesFilter } from '../types/filters.js';
import { pageSchema } from '../standard-schemas.js';
import { BasePostLikeResource } from '../core/resource-base.js';
import { WordPressContentQuery } from '../content-query.js';
import type { WordPressRuntime } from '../core/transport.js';

const missingRawPageMessage =
  'Raw page content is unavailable. The current credentials may not have edit capabilities for this page.';

/**
 * WordPress pages resource with full CRUD support.
 * 
 * @example
 * ```typescript
 * const pages = PagesResource.create(runtime);
 * const allPages = await pages.getPages();
 * const singlePage = await pages.getPage(123).get();
 * ```
 */
export class PagesResource extends BasePostLikeResource<
  WordPressPage,
  ExtensibleFilter<PagesFilter>,
  WordPressPostWriteBase
> {
  /**
   * Creates a pages resource instance.
   */
  static create(runtime: WordPressRuntime, defaultBlockParser?: WordPressBlockParser): PagesResource {
    return new PagesResource({
      runtime,
      endpoint: '/pages',
      missingRawMessage: missingRawPageMessage,
      defaultBlockParser,
      defaultSchema: pageSchema,
    });
  }

  /**
   * Alias for list() - gets pages matching filter.
   */
  getPages(filter?: ExtensibleFilter<PagesFilter>, options?: WordPressRequestOverrides): Promise<WordPressPage[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all pages via pagination.
   */
  getAllPages(
    filter?: Omit<ExtensibleFilter<PagesFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressPage[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets pages with pagination metadata.
   */
  getPagesPaginated(
    filter?: ExtensibleFilter<PagesFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressPage>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getByIdAsQuery() - gets page by ID as content query.
   */
  getPage(id: number, options?: WordPressRequestOverrides): WordPressContentQuery<WordPressPage> {
    return this.getByIdAsQuery(id, options);
  }

  /**
   * Alias for getBySlugAsQuery() - gets page by slug as content query.
   */
  getPageBySlug(slug: string, options?: WordPressRequestOverrides): WordPressContentQuery<WordPressPage | undefined> {
    return this.getBySlugAsQuery(slug, options);
  }
}
