import type { WordPressBlockJsonSchema } from "../blocks.js";
import type { ContentItemQuery } from "../builders/content-item-query.js";
import type { ListAllOptions } from "../core/pagination.js";
import type {
  WordPressAuthor,
  WordPressBlockType,
  WordPressComment,
  WordPressMedia,
  WordPressPostLike,
  WordPressSettings,
} from "../schemas.js";
import type { WordPressMediaUploadInput } from "./client.js";
import type { WordPressResourceDescription } from "./discovery.js";
import type {
  DeleteOptions,
  UserDeleteOptions,
  WordPressWritePayload,
} from "./payloads.js";

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
  page?: number;
  perPage?: number;
}

/**
 * Paginated response wrapper for higher-level helpers.
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * Normalized delete result returned by resource delete helpers.
 */
export interface WordPressDeleteResult {
  deleted: boolean;
  id: number;
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
  create: (
    input: TCreate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
  delete: (
    id: number,
    options?: DeleteOptions & WordPressRequestOverrides,
  ) => Promise<WordPressDeleteResult>;
  /**
   * Returns a JSON Schema descriptor for this content resource.
   * @param options Optional request overrides
   */
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  item: (
    idOrSlug: number | string,
    options?: WordPressRequestOverrides & {
      embed?: boolean | string[];
      fields?: string[];
    },
  ) => ContentItemQuery<TResource>;
  list: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource[]>;
  listAll: (
    filter?: Omit<TFilter, "page">,
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ) => Promise<TResource[]>;
  listPaginated: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<PaginatedResponse<TResource>>;
  update: (
    id: number,
    input: TUpdate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
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
  create: (
    input: TCreate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
  delete: (
    id: number,
    options?: DeleteOptions & WordPressRequestOverrides,
  ) => Promise<WordPressDeleteResult>;
  /**
   * Returns a JSON Schema descriptor for this term resource.
   * @param options Optional request overrides
   */
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  item: (
    idOrSlug: number | string,
    options?: WordPressRequestOverrides & { fields?: string[] },
  ) => Promise<TResource | undefined>;
  list: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource[]>;
  listAll: (
    filter?: Omit<TFilter, "page">,
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ) => Promise<TResource[]>;
  listPaginated: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<PaginatedResponse<TResource>>;
  update: (
    id: number,
    input: TUpdate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
}

/**
 * Fluent media resource API surface with schema discovery and binary uploads.
 */
export interface MediaResourceClient<
  TResource extends WordPressMedia = WordPressMedia,
  TFilter extends QueryParams & PaginationParams = QueryParams &
    PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  create: (
    input: TCreate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
  delete: (
    id: number,
    options?: DeleteOptions & WordPressRequestOverrides,
  ) => Promise<WordPressDeleteResult>;
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  getImageUrl: (media: TResource, size?: string) => string;
  item: {
    (
      id: number,
      options?: WordPressRequestOverrides & { fields?: string[] },
    ): Promise<TResource | undefined>;
    (
      slug: string,
      options?: WordPressRequestOverrides & { fields?: string[] },
    ): Promise<TResource | undefined>;
  };
  list: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource[]>;
  listAll: (
    filter?: Omit<TFilter, "page">,
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ) => Promise<TResource[]>;
  listPaginated: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<PaginatedResponse<TResource>>;
  update: (
    id: number,
    input: TUpdate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
  upload: (
    input: WordPressMediaUploadInput,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
}

/**
 * Fluent comments resource API surface with schema discovery.
 */
export interface CommentsResourceClient<
  TResource extends WordPressComment = WordPressComment,
  TFilter extends QueryParams & PaginationParams = QueryParams &
    PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  create: (
    input: TCreate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
  delete: (
    id: number,
    options?: DeleteOptions & WordPressRequestOverrides,
  ) => Promise<WordPressDeleteResult>;
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  item: (
    id: number,
    options?: WordPressRequestOverrides & { fields?: string[] },
  ) => Promise<TResource | undefined>;
  list: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource[]>;
  listAll: (
    filter?: Omit<TFilter, "page">,
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ) => Promise<TResource[]>;
  listPaginated: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<PaginatedResponse<TResource>>;
  update: (
    id: number,
    input: TUpdate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
}

/**
 * Fluent users resource API surface with schema discovery and `/me` support.
 */
export interface UsersResourceClient<
  TResource extends WordPressAuthor = WordPressAuthor,
  TFilter extends QueryParams & PaginationParams = QueryParams &
    PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> {
  create: (
    input: TCreate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
  delete: (
    id: number,
    options?: UserDeleteOptions & WordPressRequestOverrides,
  ) => Promise<WordPressDeleteResult>;
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  item: {
    (
      id: number,
      options?: WordPressRequestOverrides & { fields?: string[] },
    ): Promise<TResource | undefined>;
    (
      slug: string,
      options?: WordPressRequestOverrides & { fields?: string[] },
    ): Promise<TResource | undefined>;
  };
  list: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource[]>;
  listAll: (
    filter?: Omit<TFilter, "page">,
    options?: WordPressRequestOverrides,
    listOptions?: ListAllOptions,
  ) => Promise<TResource[]>;
  listPaginated: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<PaginatedResponse<TResource>>;
  me: (options?: WordPressRequestOverrides) => Promise<TResource>;
  update: (
    id: number,
    input: TUpdate,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
}

/**
 * Fluent settings singleton API surface with schema discovery.
 */
export interface SettingsResourceClient<
  TResource extends WordPressSettings = WordPressSettings,
> {
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  get: (options?: WordPressRequestOverrides) => Promise<TResource>;
  update: (
    input: Partial<WordPressSettings> & Record<string, unknown>,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource>;
}

/**
 * Fluent block types resource API surface.
 */
export interface BlocksResourceClient<
  TResource extends WordPressBlockType = WordPressBlockType,
  TFilter extends QueryParams = QueryParams,
> {
  describe: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>;
  item: (
    name: string,
    options?: WordPressRequestOverrides & {
      context?: "view" | "embed" | "edit";
      fields?: string[];
    },
  ) => Promise<TResource | undefined>;
  list: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<TResource[]>;
  schema: (
    name: string,
    options?: WordPressRequestOverrides & {
      context?: "view" | "embed" | "edit";
      fields?: string[];
    },
  ) => Promise<WordPressBlockJsonSchema | undefined>;
  schemas: (
    filter?: TFilter,
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressBlockJsonSchema[]>;
}
