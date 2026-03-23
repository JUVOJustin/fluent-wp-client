/**
 * Re-exports all type definitions and runtime utilities from their organized locations.
 *
 * Internal source modules should import from specific paths (types/filters, types/payloads, etc.)
 * but this barrel ensures backward compatibility for existing consumer imports.
 */
export type {
  PostsFilter,
  PagesFilter,
  MediaFilter,
  CategoriesFilter,
  TagsFilter,
  UsersFilter,
  CommentsFilter,
  SearchFilter,
} from './types/filters.js';

export type {
  WordPressWritePayload,
  TermWriteInput,
  UserWriteInput,
  DeleteOptions,
  UserDeleteOptions,
} from './types/payloads.js';

export type {
  QueryParamPrimitive,
  QueryParamValue,
  QueryParams,
  IncludeExcludeParam,
  FetchResult,
  PaginationParams,
  PaginatedResponse,
  WordPressDeleteResult,
  ContentResourceClient,
  TermsResourceClient,
} from './types/resources.js';

export { filterToParams, compactPayload } from './core/params.js';
