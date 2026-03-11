import type { WordPressBlockParser } from '../blocks.js';
import { createPostLikeReadMethods } from '../content-read-methods.js';
import type { WordPressPage } from '../schemas.js';
import type { FetchResult } from '../types/resources.js';
import type { PagesFilter } from '../types/filters.js';

const missingRawPageMessage =
  'Raw page content is unavailable. The current credentials may not have edit capabilities for this page.';

/**
 * Pages API methods factory for typed read operations.
 */
export function createPagesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>,
  defaultBlockParser?: WordPressBlockParser,
) {
  const core = createPostLikeReadMethods<WordPressPage, PagesFilter>({
    resource: 'pages',
    missingRawMessage: missingRawPageMessage,
    fetchAPI,
    fetchAPIPaginated,
    defaultBlockParser,
  });

  return {
    /**
     * Gets pages with optional filtering (single page, max 100 items).
     */
    getPages: core.list,

    /**
     * Gets all pages by automatically paginating through all pages.
     */
    getAllPages: core.listAll,

    /**
     * Gets pages with pagination metadata.
     */
    getPagesPaginated: core.listPaginated,

    /**
     * Gets one page by ID.
     */
    getPage: core.getById,

    /**
     * Gets one page by slug.
     */
    getPageBySlug: core.getBySlug,
  };
}
