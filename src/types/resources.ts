import type { DeleteOptions, UserDeleteOptions, WordPressWritePayload } from './payloads.js';
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
import type { ResourceItemQueryBuilder } from '../builders/resource-item-relations.js';
import type {
  WordPressAuthor,
  WordPressComment,
  WordPressMedia,
  WordPressPostLike,
  WordPressSettings,
} from '../schemas.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type { WordPressResourceDescription } from './discovery.js';
import type { WordPressMediaUploadInput } from './client.js';

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

export type MediaRelation = 'author' | 'post';
export type AllMediaRelations = MediaRelation | string;

export type CommentRelation = 'author' | 'post' | 'parent';
export type AllCommentRelations = CommentRelation | string;

export type UserRelation = string;

type MediaRelationMap = Record<string, unknown> & {
  author: WordPressAuthor | null;
  post: WordPressPostLike | null;
};

type CommentRelationMap = Record<string, unknown> & {
  author: WordPressAuthor | null;
  post: WordPressPostLike | null;
  parent: WordPressComment | null;
};

type UserRelationMap = Record<string, unknown>;

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
  /**
   * Returns a JSON Schema descriptor for this content resource.
   * @param options Optional request overrides
   */
  describe: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>;
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
  /**
   * Returns a JSON Schema descriptor for this term resource.
   * @param options Optional request overrides
   */
  describe: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>;
}

/**
 * Fluent media resource API surface with schema discovery and binary uploads.
 */
export interface MediaResourceClient<
  TResource extends WordPressMedia = WordPressMedia,
  TFilter extends QueryParams & PaginationParams = QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  list: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listAll: (filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listPaginated: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<PaginatedResponse<TResource>>;
  item: {
    (id: number, options?: WordPressRequestOverrides): ResourceItemQueryBuilder<TResource, MediaRelationMap, AllMediaRelations>;
    (slug: string, options?: WordPressRequestOverrides): ResourceItemQueryBuilder<TResource, MediaRelationMap, AllMediaRelations>;
  };
  create: <TResponse = TResource>(
    input: TCreate,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => Promise<TResponse>;
  upload: <TResponse = TResource>(
    input: WordPressMediaUploadInput,
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
  getImageUrl: (media: TResource, size?: string) => string;
  describe: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>;
}

/**
 * Fluent comments resource API surface with schema discovery.
 */
export interface CommentsResourceClient<
  TResource extends WordPressComment = WordPressComment,
  TFilter extends QueryParams & PaginationParams = QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  list: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listAll: (filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listPaginated: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<PaginatedResponse<TResource>>;
  item: (id: number, options?: WordPressRequestOverrides) => ResourceItemQueryBuilder<TResource, CommentRelationMap, AllCommentRelations>;
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
  describe: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>;
}

/**
 * Fluent users resource API surface with schema discovery and `/me` support.
 */
export interface UsersResourceClient<
  TResource extends WordPressAuthor = WordPressAuthor,
  TFilter extends QueryParams & PaginationParams = QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  list: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listAll: (filter?: Omit<TFilter, 'page'>, options?: WordPressRequestOverrides) => Promise<TResource[]>;
  listPaginated: (filter?: TFilter, options?: WordPressRequestOverrides) => Promise<PaginatedResponse<TResource>>;
  item: {
    (id: number, options?: WordPressRequestOverrides): ResourceItemQueryBuilder<TResource, UserRelationMap, UserRelation>;
    (slug: string, options?: WordPressRequestOverrides): ResourceItemQueryBuilder<TResource, UserRelationMap, UserRelation>;
  };
  me: (options?: WordPressRequestOverrides) => Promise<TResource>;
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
  delete: (id: number, options?: UserDeleteOptions & WordPressRequestOverrides) => Promise<WordPressDeleteResult>;
  describe: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>;
}

/**
 * Fluent settings singleton API surface with schema discovery.
 */
export interface SettingsResourceClient<
  TResource extends WordPressSettings = WordPressSettings,
> {
  get: (options?: WordPressRequestOverrides) => Promise<TResource>;
  update: <TResponse = TResource>(
    input: Partial<WordPressSettings> & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ) => Promise<TResponse>;
  describe: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>;
}
