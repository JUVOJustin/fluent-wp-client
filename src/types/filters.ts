import type { IncludeExcludeParam, PaginationParams } from './resources.js';

/**
 * Common filter fields shared by the posts, pages, and media collection endpoints.
 *
 * Extend this interface rather than duplicating fields when adding a new
 * content-like filter type.
 */
export interface BaseContentFilter extends PaginationParams {
  context?: 'view' | 'embed' | 'edit';
  author?: number;
  authorExclude?: IncludeExcludeParam;
  include?: IncludeExcludeParam;
  exclude?: IncludeExcludeParam;
  slug?: string[];
  searchColumns?: string[];
  search?: string;
  after?: string;
  modifiedAfter?: string;
  before?: string;
  modifiedBefore?: string;
  offset?: number;
  order?: 'asc' | 'desc';
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
}

/**
 * Filter options for posts.
 */
export interface PostsFilter extends BaseContentFilter {
  status?: 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash';
  categories?: IncludeExcludeParam;
  categoriesExclude?: IncludeExcludeParam;
  tags?: IncludeExcludeParam;
  tagsExclude?: IncludeExcludeParam;
  sticky?: boolean;
  taxRelation?: 'AND' | 'OR';
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include' | 'parent' | 'include_slugs';
}

/**
 * Filter options for pages.
 */
export interface PagesFilter extends BaseContentFilter {
  status?: 'publish' | 'draft' | 'pending' | 'private' | 'future' | 'trash';
  parent?: number;
  parentExclude?: IncludeExcludeParam;
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include' | 'menu_order' | 'include_slugs';
}

/**
 * Filter options for media.
 */
export interface MediaFilter extends BaseContentFilter {
  mediaType?: 'image' | 'video' | 'audio' | 'application';
  mimeType?: string;
  parent?: number;
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance' | 'author' | 'include' | 'parent' | 'include_slugs';
}

/**
 * Filter options for categories.
 */
export interface CategoriesFilter extends PaginationParams {
  hideEmpty?: boolean;
  parent?: number;
  exclude?: IncludeExcludeParam;
  include?: IncludeExcludeParam;
  search?: string;
  orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group' | 'include';
  order?: 'asc' | 'desc';
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
}

/**
 * Filter options for tags.
 */
export interface TagsFilter extends PaginationParams {
  hideEmpty?: boolean;
  exclude?: IncludeExcludeParam;
  include?: IncludeExcludeParam;
  search?: string;
  orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group' | 'include';
  order?: 'asc' | 'desc';
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
}

/**
 * Filter options for users.
 */
export interface UsersFilter extends PaginationParams {
  roles?: string[];
  exclude?: IncludeExcludeParam;
  include?: IncludeExcludeParam;
  search?: string;
  orderby?: 'id' | 'name' | 'slug' | 'email' | 'url' | 'registered_date' | 'include';
  order?: 'asc' | 'desc';
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
}

/**
 * Filter options for comments.
 */
export interface CommentsFilter extends PaginationParams {
  post?: number;
  parent?: number;
  author?: number;
  authorExclude?: IncludeExcludeParam;
  include?: IncludeExcludeParam;
  exclude?: IncludeExcludeParam;
  search?: string;
  status?: 'hold' | 'approve' | 'spam' | 'trash';
  orderby?: 'date' | 'date_gmt' | 'id' | 'include' | 'post' | 'parent' | 'type';
  order?: 'asc' | 'desc';
  /** Restrict the response to a subset of fields. Maps to the `_fields` REST API parameter. */
  fields?: string[];
}

/**
 * Filter options for the cross-resource `/wp/v2/search` endpoint.
 *
 * The `search` field is required by the WordPress API but is accepted as a
 * separate first argument in the `searchContent()` convenience method. Use this
 * interface directly when calling the lower-level WPAPI builder chain or when
 * composing filter objects manually.
 *
 * When `subtype` is an array it is serialised using WordPress bracket notation
 * (`subtype[]=post&subtype[]=page`) so that multiple subtypes can be filtered
 * in a single request.
 */
export interface SearchFilter extends PaginationParams {
  search: string;
  type?: 'post' | 'term' | 'post-format';
  subtype?: string | string[];
  context?: 'view' | 'embed';
  include?: IncludeExcludeParam;
  exclude?: IncludeExcludeParam;
}
