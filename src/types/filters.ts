import type { PaginationParams } from './resources.js';

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
  include?: number[];
  exclude?: number[];
}
