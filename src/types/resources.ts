import type { DeleteOptions, WordPressWritePayload } from './payloads.js';
import type { AllPostRelations, PostRelationQueryBuilder, SelectedPostRelations } from '../builders/relations.js';
import type { WordPressPostLike } from '../schemas.js';

/**
 * Per-request transport overrides supported by high-level helper methods.
 */
export interface WordPressRequestOverrides {
  headers?: Record<string, string>;
}

/**
 * Primitive value supported for query-string conversion.
 */
export type QueryParamPrimitive = string | number | boolean;

/**
 * Value shapes accepted by the query-string converter.
 */
export type QueryParamValue =
  | QueryParamPrimitive
  | QueryParamPrimitive[]
  | null
  | undefined;

/**
 * Generic query object accepted by low-level request helpers.
 */
export type QueryParams = Record<string, QueryParamValue>;

/**
 * Serialized query object sent to the request layer.
 */
export type SerializedQueryParams = Record<string, string | string[]>;

/**
 * Extends one known filter shape with endpoint-specific custom query params.
 */
export type ExtensibleFilter<TKnown extends object> = TKnown & QueryParams;

/**
 * Common include/exclude parameter type used across collection filter interfaces.
 */
export type IncludeExcludeParam = number[];

/**
 * Internal fetch result with pagination headers.
 */
export interface FetchResult<T> {
  data: T;
  total: number;
  totalPages: number;
}

/**
 * Pagination options for list endpoints.
 */
export interface PaginationParams {
  perPage?: number;
  page?: number;
}

/**
 * Paginated response wrapper for higher-level helpers.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}

/**
 * Normalized delete result returned by resource delete helpers.
 */
export interface WordPressDeleteResult {
  id: number;
  deleted: boolean;
  previous?: unknown;
}

/**
 * Generic content resource API surface for custom post type usage.
 */
export interface ContentResourceClient<
  TResource extends WordPressPostLike,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload,
> {
  list: (filter?: QueryParams, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listAll: (filter?: Omit<QueryParams, 'page'>, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listPaginated: (filter?: QueryParams & PaginationParams, options?: WordPressRequestOverrides) => Promise<PaginatedResponse<TResource>>;
  getById: (id: number, options?: WordPressRequestOverrides) => Promise<TResource>;
  getBySlug: (slug: string, options?: WordPressRequestOverrides) => Promise<TResource | undefined>;
  item: (idOrSlug: number | string) => PostRelationQueryBuilder<[], TResource>;
  getWithRelations: <TRelations extends readonly AllPostRelations[]>(
    idOrSlug: number | string,
    ...relations: TRelations
  ) => Promise<TResource & { related: SelectedPostRelations<TRelations> }>;
  create: (input: TCreate, options?: WordPressRequestOverrides) => Promise<TResource>;
  update: (id: number, input: TUpdate, options?: WordPressRequestOverrides) => Promise<TResource>;
  delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
}

/**
 * Generic term resource API surface for custom taxonomy usage.
 */
export interface TermsResourceClient<TResource, TCreate extends WordPressWritePayload, TUpdate extends WordPressWritePayload> {
  list: (filter?: QueryParams, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listAll: (filter?: Omit<QueryParams, 'page'>, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listPaginated: (filter?: QueryParams & PaginationParams, options?: WordPressRequestOverrides) => Promise<PaginatedResponse<TResource>>;
  getById: (id: number, options?: WordPressRequestOverrides) => Promise<TResource>;
  getBySlug: (slug: string, options?: WordPressRequestOverrides) => Promise<TResource | undefined>;
  create: (input: TCreate, options?: WordPressRequestOverrides) => Promise<TResource>;
  update: (id: number, input: TUpdate, options?: WordPressRequestOverrides) => Promise<TResource>;
  delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
}
