import type { WordPressCategory, WordPressPostLike } from '../schemas.js';
import type { WordPressRequestOptions, WordPressRequestOverrides, WordPressRequestResult } from '../client-types.js';
import { validateWithStandardSchema, type WordPressStandardSchema } from '../core/validation.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import { createWordPressPaginator } from '../core/pagination.js';
import { compactPayload, filterToParams, normalizeDeleteResult } from '../core/params.js';
import {
  PostRelationQueryBuilder,
  type AllPostRelations,
  type PostRelationClient,
  type SelectedPostRelations,
} from '../builders/relations.js';
import type {
  ContentResourceClient,
  ExtensibleFilter,
  FetchResult,
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  SerializedQueryParams,
  TermsResourceClient,
  WordPressDeleteResult,
} from '../types/resources.js';
import type {
  DeleteOptions,
  TermWriteInput,
  WordPressWritePayload,
} from '../types/payloads.js';

/**
 * Runtime hooks required for generic content and term method groups.
 */
export interface ContentTermMethodDependencies {
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>;
  fetchAPIPaginated: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<FetchResult<T>>;
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  executeMutation: <T>(options: WordPressRequestOptions, responseSchema?: WordPressStandardSchema<T>) => Promise<T>;
  relationClient: PostRelationClient;
}

/**
 * Creates generic content and taxonomy method groups used by the main client.
 */
export function createContentTermMethods(dependencies: ContentTermMethodDependencies) {
  const contentPaginator = createWordPressPaginator<QueryParams & PaginationParams, unknown>({
    fetchPage: (currentFilter, context) => {
      const { resource, ...queryFilter } = currentFilter as QueryParams & PaginationParams & { resource: string };
      const params = filterToParams({ ...queryFilter, _embed: 'true' });
      return dependencies.fetchAPIPaginated<unknown[]>(`/${resource}`, params, context as WordPressRequestOverrides | undefined);
    },
  });

  const termPaginator = createWordPressPaginator<QueryParams & PaginationParams, unknown>({
    fetchPage: (currentFilter, context) => {
      const { resource, ...queryFilter } = currentFilter as QueryParams & PaginationParams & { resource: string };
      const params = filterToParams(queryFilter);
      return dependencies.fetchAPIPaginated<unknown[]>(`/${resource}`, params, context as WordPressRequestOverrides | undefined);
    },
  });

  /**
   * Validates one generic content resource response when a schema is configured.
   */
  async function validateContentItem<TContent>(
    value: unknown,
    responseSchema?: WordPressStandardSchema<TContent>,
  ): Promise<TContent> {
    if (!responseSchema) {
      return value as TContent;
    }

    return validateWithStandardSchema(
      responseSchema,
      value,
      'WordPress content response validation failed',
    );
  }

  /**
   * Validates one generic content resource collection when a schema is configured.
   */
  async function validateContentCollection<TContent>(
    values: unknown[],
    responseSchema?: WordPressStandardSchema<TContent>,
  ): Promise<TContent[]> {
    if (!responseSchema) {
      return values as TContent[];
    }

    return Promise.all(values.map((value) => validateContentItem(value, responseSchema)));
  }

  /**
   * Lists one content resource (posts/pages/custom post types).
   */
  async function getContentCollection<TContent = WordPressPostLike>(
    resource: string,
    filter: QueryParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const params = filterToParams({ ...filter, _embed: 'true' });
    return dependencies.fetchAPI<TContent[]>(`/${resource}`, params, requestOptions);
  }

  /**
   * Lists all items from one content resource using automatic pagination.
   */
  async function getAllContentCollection<TContent = WordPressPostLike>(
    resource: string,
    filter: Omit<QueryParams, 'page'> = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent[]> {
    const paginatorFilter = {
      ...filter,
      resource,
    } as Omit<QueryParams & PaginationParams & { resource: string }, 'page'>;

    return contentPaginator.listAll(paginatorFilter, requestOptions) as Promise<TContent[]>;
  }

  /**
   * Lists one content resource with pagination metadata.
   */
  async function getContentCollectionPaginated<TContent = WordPressPostLike>(
    resource: string,
    filter: QueryParams & PaginationParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TContent>> {
    const paginatorFilter = {
      ...filter,
      resource,
    } as QueryParams & PaginationParams & { resource: string };

    return contentPaginator.listPaginated(paginatorFilter, requestOptions) as Promise<PaginatedResponse<TContent>>;
  }

  /**
   * Fetches one content item by numeric ID.
   */
  async function getContent<TContent = WordPressPostLike>(
    resource: string,
    id: number,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent> {
    return dependencies.fetchAPI<TContent>(`/${resource}/${id}`, { _embed: 'true' }, requestOptions);
  }

  /**
   * Fetches one content item by slug.
   */
  async function getContentBySlug<TContent = WordPressPostLike>(
    resource: string,
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent | undefined> {
    const items = await dependencies.fetchAPI<TContent[]>(`/${resource}`, { slug, _embed: 'true' }, requestOptions);
    return items[0];
  }

  /**
   * Creates one content item for any post-like REST resource.
   */
  async function createContent<TContent = WordPressPostLike, TInput extends WordPressWritePayload = WordPressWritePayload>(
    resource: string,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TContent>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent> {
    return dependencies.executeMutation<TContent>(
      applyRequestOverrides({
        endpoint: `/${resource}`,
        method: 'POST',
        body: compactPayload(input),
      }, requestOptions, 'Mutation helper options'),
      responseSchema,
    );
  }

  /**
   * Updates one content item for any post-like REST resource.
   */
  async function updateContent<TContent = WordPressPostLike, TInput extends WordPressWritePayload = WordPressWritePayload>(
    resource: string,
    id: number,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TContent>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TContent> {
    return dependencies.executeMutation<TContent>(
      applyRequestOverrides({
        endpoint: `/${resource}/${id}`,
        method: 'POST',
        body: compactPayload(input),
      }, requestOptions, 'Mutation helper options'),
      responseSchema,
    );
  }

  /**
   * Deletes one content item for any post-like REST resource.
   */
  async function deleteContent(
    resource: string,
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data } = await dependencies.request<unknown>(applyRequestOverrides({
      endpoint: `/${resource}/${id}`,
      method: 'DELETE',
      params,
    }, options, 'Mutation helper options'));

    return normalizeDeleteResult(id, data);
  }

  /**
   * Lists one taxonomy term resource.
   */
  async function getTermCollection<TTerm = WordPressCategory>(
    resource: string,
    filter: QueryParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    const params = filterToParams(filter);
    return dependencies.fetchAPI<TTerm[]>(`/${resource}`, params, requestOptions);
  }

  /**
   * Lists all items from one taxonomy term resource.
   */
  async function getAllTermCollection<TTerm = WordPressCategory>(
    resource: string,
    filter: Omit<QueryParams, 'page'> = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm[]> {
    const paginatorFilter = {
      ...filter,
      resource,
    } as Omit<QueryParams & PaginationParams & { resource: string }, 'page'>;

    return termPaginator.listAll(paginatorFilter, requestOptions) as Promise<TTerm[]>;
  }

  /**
   * Lists one taxonomy term resource with pagination metadata.
   */
  async function getTermCollectionPaginated<TTerm = WordPressCategory>(
    resource: string,
    filter: QueryParams & PaginationParams = {},
    requestOptions?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<TTerm>> {
    const paginatorFilter = {
      ...filter,
      resource,
    } as QueryParams & PaginationParams & { resource: string };

    return termPaginator.listPaginated(paginatorFilter, requestOptions) as Promise<PaginatedResponse<TTerm>>;
  }

  /**
   * Fetches one term by numeric ID.
   */
  async function getTerm<TTerm = WordPressCategory>(
    resource: string,
    id: number,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    return dependencies.fetchAPI<TTerm>(`/${resource}/${id}`, undefined, requestOptions);
  }

  /**
   * Fetches one term by slug.
   */
  async function getTermBySlug<TTerm = WordPressCategory>(
    resource: string,
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm | undefined> {
    const items = await dependencies.fetchAPI<TTerm[]>(`/${resource}`, { slug }, requestOptions);
    return items[0];
  }

  /**
   * Creates one term for any taxonomy resource.
   */
  async function createTerm<TTerm = WordPressCategory, TInput extends WordPressWritePayload = TermWriteInput>(
    resource: string,
    input: TInput,
    responseSchema?: WordPressStandardSchema<TTerm>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    return dependencies.executeMutation<TTerm>(
      applyRequestOverrides({
        endpoint: `/${resource}`,
        method: 'POST',
        body: compactPayload(input),
      }, requestOptions, 'Mutation helper options'),
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
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TTerm> {
    return dependencies.executeMutation<TTerm>(
      applyRequestOverrides({
        endpoint: `/${resource}/${id}`,
        method: 'POST',
        body: compactPayload(input),
      }, requestOptions, 'Mutation helper options'),
      responseSchema,
    );
  }

  /**
   * Deletes one term for any taxonomy resource.
   */
  async function deleteTerm(
    resource: string,
    id: number,
    options: DeleteOptions & WordPressRequestOverrides = {},
  ): Promise<WordPressDeleteResult> {
    const params = options.force ? { force: 'true' } : undefined;
    const { data } = await dependencies.request<unknown>(applyRequestOverrides({
      endpoint: `/${resource}/${id}`,
      method: 'DELETE',
      params,
    }, options, 'Mutation helper options'));

    return normalizeDeleteResult(id, data);
  }

  /**
   * Builds one typed generic content resource client with optional read and
   * mutation response validation.
   */
  function content<
    TResource extends WordPressPostLike = WordPressPostLike,
    TCreate extends WordPressWritePayload = WordPressWritePayload,
    TUpdate extends WordPressWritePayload = TCreate,
  >(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, TCreate, TUpdate> {
    return {
      list: async (filter = {}, options) => validateContentCollection(
        await getContentCollection<TResource>(resource, filter as ExtensibleFilter<QueryParams>, options),
        responseSchema,
      ),
      listAll: async (filter = {}, options) => validateContentCollection(
        await getAllContentCollection<TResource>(resource, filter as Omit<ExtensibleFilter<QueryParams>, 'page'>, options),
        responseSchema,
      ),
      listPaginated: async (filter = {}, options) => {
        const result = await getContentCollectionPaginated<TResource>(resource, filter as ExtensibleFilter<QueryParams> & PaginationParams, options);

        return {
          ...result,
          data: await validateContentCollection(result.data, responseSchema),
        };
      },
      getById: async (id, options) => validateContentItem(
        await getContent<TResource>(resource, id, options),
        responseSchema,
      ),
      getBySlug: async (slug, options) => {
        const item = await getContentBySlug<TResource>(resource, slug, options);

        if (item === undefined) {
          return undefined;
        }

        return validateContentItem(item, responseSchema);
      },
      item: (idOrSlug) => new PostRelationQueryBuilder(
        dependencies.relationClient,
        typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
        (id) => getContent<TResource>(resource, id),
        (slug) => getContentBySlug<TResource>(resource, slug),
      ),
      getWithRelations: async <TRelations extends readonly AllPostRelations[]>(
        idOrSlug: number | string,
        ...relations: TRelations
      ): Promise<TResource & { related: SelectedPostRelations<TRelations> }> => {
        const query = new PostRelationQueryBuilder<TRelations, TResource>(
          dependencies.relationClient,
          typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug },
          (id) => getContent<TResource>(resource, id),
          (slug) => getContentBySlug<TResource>(resource, slug),
          relations,
        );
        const result = await query.get();
        return validateContentItem(result, responseSchema) as Promise<TResource & { related: SelectedPostRelations<TRelations> }>;
      },
      create: (input, options) => createContent<TResource, TCreate>(resource, input, responseSchema, options),
      update: (id, input, options) => updateContent<TResource, TUpdate>(resource, id, input, responseSchema, options),
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
      list: (filter = {}, options) => getTermCollection<TResource>(resource, filter as ExtensibleFilter<QueryParams>, options),
      listAll: (filter = {}, options) => getAllTermCollection<TResource>(resource, filter as Omit<ExtensibleFilter<QueryParams>, 'page'>, options),
      listPaginated: (filter = {}, options) => getTermCollectionPaginated<TResource>(resource, filter as ExtensibleFilter<QueryParams> & PaginationParams, options),
      getById: (id, options) => getTerm<TResource>(resource, id, options),
      getBySlug: (slug, options) => getTermBySlug<TResource>(resource, slug, options),
      create: (input, options) => createTerm<TResource, TCreate>(resource, input, responseSchema, options),
      update: (id, input, options) => updateTerm<TResource, TUpdate>(resource, id, input, responseSchema, options),
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
