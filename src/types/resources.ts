import type { DeleteOptions, WordPressWritePayload } from './payloads.js';
import type {
  AllPostRelations,
  ContentItemResult,
  PostRelationQueryBuilder,
} from '../builders/relations.js';
import type {
  ListRelationQueryBuilder,
  ListAllRelationQueryBuilder,
  PaginatedListRelationQueryBuilder,
} from '../builders/list-relations.js';
import type { WordPressPostLike } from '../schemas.js';
import type { WordPressStandardSchema } from '../core/validation.js';

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
 * Shared post-like resource API surface for built-in and custom content.
 */
export interface ContentResourceClient<
  TResource extends WordPressPostLike,
  TFilter extends QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  list: (filter?: TFilter, options?: WordPressRequestOverrides) => ListRelationQueryBuilder<[], TResource>;
  listAll: (filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides) => ListAllRelationQueryBuilder<[], TResource>;
  listPaginated: (filter?: TFilter, options?: WordPressRequestOverrides) => PaginatedListRelationQueryBuilder<[], TResource>;
  item: (idOrSlug: number | string, options?: WordPressRequestOverrides & { embed?: boolean }) => PostRelationQueryBuilder<[], TResource>;
  create: <TResponse = TResource>(
    input: TCreate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => Promise<TResponse>;
  update: <TResponse = TResource>(
    id: number,
    input: TUpdate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => Promise<TResponse>;
  delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
}

/**
 * Shared term resource API surface for built-in and custom taxonomies.
 */
export interface TermsResourceClient<
  TResource,
  TFilter extends QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  list: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listAll: (filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listPaginated: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<PaginatedResponse<TResource>>;
  item: (idOrSlug: number | string, options?: WordPressRequestOverrides) => Promise<TResource | undefined>;
  create: <TResponse = TResource>(
    input: TCreate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => Promise<TResponse>;
  update: <TResponse = TResource>(
    id: number,
    input: TUpdate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => Promise<TResponse>;
  delete: (id: number, options?: DeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
}
