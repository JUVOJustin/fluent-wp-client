import type { DeleteOptions, WordPressWritePayload } from './payloads.js';
import type { WordPressRequestOverrides } from '../client-types.js';

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
export interface ContentResourceClient<TResource, TCreate extends WordPressWritePayload, TUpdate extends WordPressWritePayload> {
  list: (filter?: QueryParams) => Promise<TResource[]>;
  listAll: (filter?: Omit<QueryParams, 'page'>) => Promise<TResource[]>;
  listPaginated: (filter?: QueryParams & PaginationParams) => Promise<PaginatedResponse<TResource>>;
  getById: (id: number) => Promise<TResource>;
  getBySlug: (slug: string) => Promise<TResource | undefined>;
  create: (input: TCreate, options?: WordPressRequestOverrides) => Promise<TResource>;
  update: (id: number, input: TUpdate, options?: WordPressRequestOverrides) => Promise<TResource>;
  delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
}

/**
 * Generic term resource API surface for custom taxonomy usage.
 */
export interface TermsResourceClient<TResource, TCreate extends WordPressWritePayload, TUpdate extends WordPressWritePayload> {
  list: (filter?: QueryParams) => Promise<TResource[]>;
  listAll: (filter?: Omit<QueryParams, 'page'>) => Promise<TResource[]>;
  listPaginated: (filter?: QueryParams & PaginationParams) => Promise<PaginatedResponse<TResource>>;
  getById: (id: number) => Promise<TResource>;
  getBySlug: (slug: string) => Promise<TResource | undefined>;
  create: (input: TCreate, options?: WordPressRequestOverrides) => Promise<TResource>;
  update: (id: number, input: TUpdate, options?: WordPressRequestOverrides) => Promise<TResource>;
  delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
}
