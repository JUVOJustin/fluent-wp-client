/**
 * Primitive value supported for query-string conversion.
 */
export type QueryParamPrimitive = string | number | boolean;
/**
 * Value shapes accepted by the query-string converter.
 */
export type QueryParamValue = QueryParamPrimitive | QueryParamPrimitive[] | null | undefined;
/**
 * Generic query object accepted by low-level request helpers.
 */
export type QueryParams = Record<string, QueryParamValue>;
/**
 * Shared payload shape used for create/update operations.
 */
export type WordPressWritePayload = Record<string, unknown>;
/**
 * Shared delete options used by endpoints that support force-deleting.
 */
export interface DeleteOptions {
    force?: boolean;
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
 * Filter options for posts.
 */
export interface PostsFilter extends PaginationParams {
    status?: 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash';
    categories?: number[];
    categoriesExclude?: number[];
    tags?: number[];
    tagsExclude?: number[];
    author?: number;
    authorExclude?: number[];
    search?: string;
    after?: string;
    before?: string;
    sticky?: boolean;
    orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include';
    order?: 'asc' | 'desc';
}
/**
 * Filter options for pages.
 */
export interface PagesFilter extends PaginationParams {
    status?: 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash';
    parent?: number;
    parentExclude?: number[];
    author?: number;
    authorExclude?: number[];
    search?: string;
    after?: string;
    before?: string;
    orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include' | 'menu_order';
    order?: 'asc' | 'desc';
}
/**
 * Filter options for media.
 */
export interface MediaFilter extends PaginationParams {
    mediaType?: 'image' | 'video' | 'audio' | 'application';
    mimeType?: string;
    author?: number;
    authorExclude?: number[];
    parent?: number;
    search?: string;
    after?: string;
    before?: string;
    orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include';
    order?: 'asc' | 'desc';
}
/**
 * Filter options for categories.
 */
export interface CategoriesFilter extends PaginationParams {
    hideEmpty?: boolean;
    parent?: number;
    exclude?: number[];
    include?: number[];
    search?: string;
    orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group' | 'include';
    order?: 'asc' | 'desc';
}
/**
 * Filter options for tags.
 */
export interface TagsFilter extends PaginationParams {
    hideEmpty?: boolean;
    exclude?: number[];
    include?: number[];
    search?: string;
    orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group' | 'include';
    order?: 'asc' | 'desc';
}
/**
 * Filter options for users.
 */
export interface UsersFilter extends PaginationParams {
    roles?: string[];
    exclude?: number[];
    include?: number[];
    search?: string;
    orderby?: 'id' | 'name' | 'slug' | 'email' | 'url' | 'registered_date' | 'include';
    order?: 'asc' | 'desc';
}
/**
 * Filter options for comments.
 */
export interface CommentsFilter extends PaginationParams {
    post?: number;
    parent?: number;
    author?: number;
    authorExclude?: number[];
    search?: string;
    status?: 'hold' | 'approve' | 'spam' | 'trash';
    orderby?: 'date' | 'date_gmt' | 'id' | 'include' | 'post' | 'parent' | 'type';
    order?: 'asc' | 'desc';
}
/**
 * Payload for creating/updating term resources.
 */
export interface TermWriteInput {
    name?: string;
    slug?: string;
    description?: string;
    parent?: number;
    meta?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Payload for creating/updating users.
 */
export interface UserWriteInput {
    username?: string;
    email?: string;
    password?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
    description?: string;
    roles?: string[];
    url?: string;
    [key: string]: unknown;
}
/**
 * Payload for deleting users.
 */
export interface UserDeleteOptions extends DeleteOptions {
    reassign?: number;
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
    create: (input: TCreate) => Promise<TResource>;
    update: (id: number, input: TUpdate) => Promise<TResource>;
    delete: (id: number, options?: DeleteOptions) => Promise<WordPressDeleteResult>;
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
    create: (input: TCreate) => Promise<TResource>;
    update: (id: number, input: TUpdate) => Promise<TResource>;
    delete: (id: number, options?: DeleteOptions) => Promise<WordPressDeleteResult>;
}
/**
 * Converts one filter object to WordPress API query params.
 */
export declare function filterToParams(filter: object, options?: {
    applyPerPageDefault?: boolean;
}): Record<string, string>;
/**
 * Removes undefined values before a payload is sent to WordPress.
 */
export declare function compactPayload<T extends WordPressWritePayload>(input: T): T;
