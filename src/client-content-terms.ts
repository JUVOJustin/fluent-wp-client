import type { WordPressCategory, WordPressContent } from './schemas.js';
import type { WordPressRequestOptions, WordPressRequestResult } from './client-types.js';
import type { WordPressStandardSchema } from './validation.js';
import { fetchAllPaginatedItems, fetchPaginatedResponse } from './pagination.js';
import {
  compactPayload,
  filterToParams,
  type ContentResourceClient,
  type DeleteOptions,
  type FetchResult,
  type PaginatedResponse,
  type PaginationParams,
  type QueryParams,
  type TermsResourceClient,
  type TermWriteInput,
  type WordPressDeleteResult,
  type WordPressWritePayload,
} from './types.js';

/**
 * Runtime hooks required for generic content and term method groups.
 */
export interface ContentTermMethodDependencies {
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>;
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>;
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  executeMutation: <T>(options: WordPressRequestOptions, responseSchema?: WordPressStandardSchema<T>) => Promise<T>;
}

/**
 * Creates generic content and taxonomy method groups used by the main client.
 */
export function createContentTermMethods(dependencies: ContentTermMethodDependencies) {
  /**
   * Lists one content resource (posts/pages/custom post types).
   */
  async function getContentCollection<TContent = WordPressContent>(
    resource: string,
    filter: QueryParams = {},
  ): Promise<TContent[]> {
    const params = filterToParams({ ...filter, _embed: 'true' });
    return dependencies.fetchAPI<TContent[]>(`/${resource}`, params);
  }

  /**
   * Lists all items from one content resource using automatic pagination.
   */
  async function getAllContentCollection<TContent = WordPressContent>(
    resource: string,
    filter: Omit<QueryParams, 'page'> = {},
  ): Promise<TContent[]> {
    return fetchAllPaginatedItems<TContent>({
      fetchPage: (page, perPage) => {
        const params = filterToParams({ ...filter, page, perPage, _embed: 'true' });
        return dependencies.fetchAPIPaginated<TContent[]>(`/${resource}`, params);
      },
    });
  }

  /**
   * Lists one content resource with pagination metadata.
   */
  async function getContentCollectionPaginated<TContent = WordPressContent>(
    resource: string,
    filter: QueryParams & PaginationParams = {},
  ): Promise<PaginatedResponse<TContent>> {
    return fetchPaginatedResponse<TContent>({
      runtime: {
        fetchPage: (currentPage, currentPerPage) => {
          const params = filterToParams({
            ...filter,
            ...(currentPage !== undefined ? { page: currentPage } : {}),
            ...(currentPerPage !== undefined ? { perPage: currentPerPage } : {}),
            _embed: 'true',
          });
          return dependencies.fetchAPIPaginated<TContent[]>(`/${resource}`, params);
        },
      },
      page: typeof filter.page === 'number' ? filter.page : undefined,
      perPage: typeof filter.perPage === 'number' ? filter.perPage : undefined,
    });
  }

  /**
   * Fetches one content item by numeric ID.
   */
  async function getContent<TContent = WordPressContent>(resource: string, id: number): Promise<TContent> {
    return dependencies.fetchAPI<TContent>(`/${resource}/${id}`, { _embed: 'true' });
  }

  /**
   * Fetches one content item by slug.
   */
  async function getContentBySlug<TContent = WordPressContent>(resource: string, slug: string): Promise<TContent | undefined> {
    const items = await dependencies.fetchAPI<TContent[]>(`/${resource}`, { slug, _embed: 'true' });
    return items[0];
  }

  /**
   * Creates one content item for any post-like REST resource.
   */
  async function createContent<TContent = WordPressContent, TInput extends WordPressWritePayload = WordPressWritePayload>(
    resource: string,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TContent>,
  ): Promise<TContent> {
    return dependencies.executeMutation<TContent>(
      {
        endpoint: `/${resource}`,
        method: 'POST',
        body: compactPayload(input),
      },
      responseSchema,
    );
  }

  /**
   * Updates one content item for any post-like REST resource.
   */
  async function updateContent<TContent = WordPressContent, TInput extends WordPressWritePayload = WordPressWritePayload>(
    resource: string,
    id: number,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TContent>,
  ): Promise<TContent> {
    return dependencies.executeMutation<TContent>(
      {
        endpoint: `/${resource}/${id}`,
        method: 'POST',
        body: compactPayload(input),
      },
      responseSchema,
    );
  }

  /**
   * Deletes one content item for any post-like REST resource.
   */
  async function deleteContent(
    resource: string,
    id: number,
    options: DeleteOptions = {},
  ): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data } = await dependencies.request<unknown>({
      endpoint: `/${resource}/${id}`,
      method: 'DELETE',
      params,
    });

    if (
      typeof data === 'object'
      && data !== null
      && 'deleted' in data
      && (data as Record<string, unknown>).deleted === true
    ) {
      return {
        id,
        deleted: true,
        previous: (data as Record<string, unknown>).previous,
      };
    }

    return { id, deleted: false };
  }

  /**
   * Lists one taxonomy term resource.
   */
  async function getTermCollection<TTerm = WordPressCategory>(
    resource: string,
    filter: QueryParams = {},
  ): Promise<TTerm[]> {
    const params = filterToParams(filter);
    return dependencies.fetchAPI<TTerm[]>(`/${resource}`, params);
  }

  /**
   * Lists all items from one taxonomy term resource.
   */
  async function getAllTermCollection<TTerm = WordPressCategory>(
    resource: string,
    filter: Omit<QueryParams, 'page'> = {},
  ): Promise<TTerm[]> {
    return fetchAllPaginatedItems<TTerm>({
      fetchPage: (page, perPage) => {
        const params = filterToParams({ ...filter, page, perPage });
        return dependencies.fetchAPIPaginated<TTerm[]>(`/${resource}`, params);
      },
    });
  }

  /**
   * Lists one taxonomy term resource with pagination metadata.
   */
  async function getTermCollectionPaginated<TTerm = WordPressCategory>(
    resource: string,
    filter: QueryParams & PaginationParams = {},
  ): Promise<PaginatedResponse<TTerm>> {
    return fetchPaginatedResponse<TTerm>({
      runtime: {
        fetchPage: (currentPage, currentPerPage) => {
          const params = filterToParams({
            ...filter,
            ...(currentPage !== undefined ? { page: currentPage } : {}),
            ...(currentPerPage !== undefined ? { perPage: currentPerPage } : {}),
          });
          return dependencies.fetchAPIPaginated<TTerm[]>(`/${resource}`, params);
        },
      },
      page: typeof filter.page === 'number' ? filter.page : undefined,
      perPage: typeof filter.perPage === 'number' ? filter.perPage : undefined,
    });
  }

  /**
   * Fetches one term by numeric ID.
   */
  async function getTerm<TTerm = WordPressCategory>(resource: string, id: number): Promise<TTerm> {
    return dependencies.fetchAPI<TTerm>(`/${resource}/${id}`);
  }

  /**
   * Fetches one term by slug.
   */
  async function getTermBySlug<TTerm = WordPressCategory>(resource: string, slug: string): Promise<TTerm | undefined> {
    const items = await dependencies.fetchAPI<TTerm[]>(`/${resource}`, { slug });
    return items[0];
  }

  /**
   * Creates one term for any taxonomy resource.
   */
  async function createTerm<TTerm = WordPressCategory, TInput extends WordPressWritePayload = TermWriteInput>(
    resource: string,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TTerm>,
  ): Promise<TTerm> {
    return dependencies.executeMutation<TTerm>(
      {
        endpoint: `/${resource}`,
        method: 'POST',
        body: compactPayload(input),
      },
      responseSchema,
    );
  }

  /**
   * Updates one term for any taxonomy resource.
   */
  async function updateTerm<TTerm = WordPressCategory, TInput extends WordPressWritePayload = TermWriteInput>(
    resource: string,
    id: number,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TTerm>,
  ): Promise<TTerm> {
    return dependencies.executeMutation<TTerm>(
      {
        endpoint: `/${resource}/${id}`,
        method: 'POST',
        body: compactPayload(input),
      },
      responseSchema,
    );
  }

  /**
   * Deletes one term for any taxonomy resource.
   */
  async function deleteTerm(resource: string, id: number, options: DeleteOptions = {}): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data } = await dependencies.request<unknown>({
      endpoint: `/${resource}/${id}`,
      method: 'DELETE',
      params,
    });

    if (
      typeof data === 'object'
      && data !== null
      && 'deleted' in data
      && (data as Record<string, unknown>).deleted === true
    ) {
      return {
        id,
        deleted: true,
        previous: (data as Record<string, unknown>).previous,
      };
    }

    return {
      id,
      deleted: false,
    };
  }

  /**
   * Builds one typed generic content resource client.
   */
  function content<
    TResource = WordPressContent,
    TCreate extends WordPressWritePayload = WordPressWritePayload,
    TUpdate extends WordPressWritePayload = TCreate,
  >(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, TCreate, TUpdate> {
    return {
      list: (filter = {}) => getContentCollection<TResource>(resource, filter),
      listAll: (filter = {}) => getAllContentCollection<TResource>(resource, filter),
      listPaginated: (filter = {}) => getContentCollectionPaginated<TResource>(resource, filter),
      getById: (id) => getContent<TResource>(resource, id),
      getBySlug: (slug) => getContentBySlug<TResource>(resource, slug),
      create: (input) => createContent<TResource, TCreate>(resource, input, responseSchema),
      update: (id, input) => updateContent<TResource, TUpdate>(resource, id, input, responseSchema),
      delete: (id, options) => deleteContent(resource, id, options),
    };
  }

  /**
   * Builds one typed generic term resource client.
   */
  function terms<
    TResource = WordPressCategory,
    TCreate extends WordPressWritePayload = TermWriteInput,
    TUpdate extends WordPressWritePayload = TCreate,
  >(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): TermsResourceClient<TResource, TCreate, TUpdate> {
    return {
      list: (filter = {}) => getTermCollection<TResource>(resource, filter),
      listAll: (filter = {}) => getAllTermCollection<TResource>(resource, filter),
      listPaginated: (filter = {}) => getTermCollectionPaginated<TResource>(resource, filter),
      getById: (id) => getTerm<TResource>(resource, id),
      getBySlug: (slug) => getTermBySlug<TResource>(resource, slug),
      create: (input) => createTerm<TResource, TCreate>(resource, input, responseSchema),
      update: (id, input) => updateTerm<TResource, TUpdate>(resource, id, input, responseSchema),
      delete: (id, options) => deleteTerm(resource, id, options),
    };
  }

  return {
    getContentCollection,
    getAllContentCollection,
    getContentCollectionPaginated,
    getContent,
    getContentBySlug,
    createContent,
    updateContent,
    deleteContent,
    getTermCollection,
    getAllTermCollection,
    getTermCollectionPaginated,
    getTerm,
    getTermBySlug,
    createTerm,
    updateTerm,
    deleteTerm,
    content,
    terms,
  };
}
