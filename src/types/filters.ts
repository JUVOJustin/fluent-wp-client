import type { IncludeExcludeParam, PaginationParams } from "./resources.js";

/**
 * Common filter fields shared by the posts, pages, and media collection endpoints.
 *
 * Extend this interface rather than duplicating fields when adding a new
 * content-like filter type.
 */
export interface BaseContentFilter extends PaginationParams {
  after?: string;
  author?: number;
  authorExclude?: IncludeExcludeParam;
  before?: string;
  context?: "view" | "embed" | "edit";
  exclude?: IncludeExcludeParam;
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
  include?: IncludeExcludeParam;
  modifiedAfter?: string;
  modifiedBefore?: string;
  offset?: number;
  order?: "asc" | "desc";
  search?: string;
  searchColumns?: string[];
  slug?: string[];
}

/**
 * Shared content filter fields for endpoints that support WordPress `_embed`.
 */
export interface EmbeddableContentFilter extends BaseContentFilter {
  /**
   * Controls WordPress `_embed` for content reads. Disabled by default.
   *
   * - `true` embeds all linked resources.
   * - A string array selects specific link relation types, e.g. `['author', 'wp:term']`.
   *
   * @see https://developer.wordpress.org/rest-api/using-the-rest-api/global-parameters/#_embed
   */
  embed?: boolean | string[];
}

/**
 * Filter options for posts.
 */
export interface PostsFilter extends EmbeddableContentFilter {
  categories?: IncludeExcludeParam;
  categoriesExclude?: IncludeExcludeParam;
  orderby?:
    | "date"
    | "id"
    | "title"
    | "slug"
    | "modified"
    | "relevance"
    | "author"
    | "include"
    | "parent"
    | "include_slugs";
  status?: "publish" | "draft" | "pending" | "private" | "future" | "trash";
  sticky?: boolean;
  tags?: IncludeExcludeParam;
  tagsExclude?: IncludeExcludeParam;
  taxRelation?: "AND" | "OR";
}

/**
 * Filter options for pages.
 */
export interface PagesFilter extends EmbeddableContentFilter {
  orderby?:
    | "date"
    | "id"
    | "title"
    | "slug"
    | "modified"
    | "relevance"
    | "author"
    | "include"
    | "menu_order"
    | "include_slugs";
  parent?: number;
  parentExclude?: IncludeExcludeParam;
  status?: "publish" | "draft" | "pending" | "private" | "future" | "trash";
}

/**
 * Filter options for media.
 */
export interface MediaFilter extends BaseContentFilter {
  mediaType?: "image" | "video" | "audio" | "application";
  mimeType?: string;
  orderby?:
    | "date"
    | "id"
    | "title"
    | "slug"
    | "modified"
    | "relevance"
    | "author"
    | "include"
    | "parent"
    | "include_slugs";
  parent?: number;
}

/**
 * Filter options for categories.
 */
export interface CategoriesFilter extends PaginationParams {
  exclude?: IncludeExcludeParam;
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
  hideEmpty?: boolean;
  include?: IncludeExcludeParam;
  order?: "asc" | "desc";
  orderby?: "id" | "name" | "slug" | "count" | "term_group" | "include";
  parent?: number;
  search?: string;
}

/**
 * Filter options for tags.
 */
export interface TagsFilter extends PaginationParams {
  exclude?: IncludeExcludeParam;
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
  hideEmpty?: boolean;
  include?: IncludeExcludeParam;
  order?: "asc" | "desc";
  orderby?: "id" | "name" | "slug" | "count" | "term_group" | "include";
  search?: string;
}

/**
 * Filter options for users.
 */
export interface UsersFilter extends PaginationParams {
  exclude?: IncludeExcludeParam;
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
  include?: IncludeExcludeParam;
  order?: "asc" | "desc";
  orderby?:
    | "id"
    | "name"
    | "slug"
    | "email"
    | "url"
    | "registered_date"
    | "include";
  roles?: string[];
  search?: string;
}

/**
 * Filter options for comments.
 */
export interface CommentsFilter extends PaginationParams {
  author?: number;
  authorExclude?: IncludeExcludeParam;
  exclude?: IncludeExcludeParam;
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
  include?: IncludeExcludeParam;
  order?: "asc" | "desc";
  orderby?: "date" | "date_gmt" | "id" | "include" | "post" | "parent" | "type";
  parent?: number;
  post?: number;
  search?: string;
  status?: "hold" | "approve" | "spam" | "trash";
}

/**
 * Filter options for the cross-resource `/wp/v2/search` endpoint.
 *
 * The `search` field is required by the WordPress API but is accepted as a
 * separate first argument in the `searchContent()` convenience method. Use this
 * interface directly when composing filter objects manually for the search endpoint.
 *
 * When `subtype` is an array it is serialised using WordPress bracket notation
 * (`subtype[]=post&subtype[]=page`) so that multiple subtypes can be filtered
 * in a single request.
 */
export interface SearchFilter extends PaginationParams {
  context?: "view" | "embed";
  exclude?: IncludeExcludeParam;
  include?: IncludeExcludeParam;
  search: string;
  subtype?: string | string[];
  type?: "post" | "term" | "post-format";
}

/**
 * Filter options for `/wp/v2/block-types`.
 */
export interface BlockTypesFilter {
  context?: "view" | "embed" | "edit";
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
  namespace?: string;
}
