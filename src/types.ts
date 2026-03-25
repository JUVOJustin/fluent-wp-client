/**
 * Re-exports all type definitions and runtime utilities from their organized locations.
 *
 * Internal source modules should import from specific paths (types/filters, types/payloads, etc.)
 * but this barrel ensures backward compatibility for existing consumer imports.
 */

// Client configuration and request types
export type {
  WordPressClientConfig,
  WordPressRequestOptions,
  WordPressRequestResult,
  WordPressMediaUploadInput,
} from './types/client.js';

// Request overrides (used across resources)
export type { WordPressRequestOverrides } from './types/resources.js';

// Filter types
export type {
  BaseContentFilter,
  PostsFilter,
  PagesFilter,
  MediaFilter,
  CategoriesFilter,
  TagsFilter,
  UsersFilter,
  CommentsFilter,
  SearchFilter,
} from './types/filters.js';

// Payload types
export type {
  WordPressWritePayload,
  TermWriteInput,
  UserWriteInput,
  DeleteOptions,
  UserDeleteOptions,
} from './types/payloads.js';

export type {
  AllCommentRelations,
  AllMediaRelations,
  CommentsResourceClient,
  ExtensibleFilter,
  QueryParamPrimitive,
  QueryParamValue,
  QueryParams,
  SerializedQueryParams,
  IncludeExcludeParam,
  FetchResult,
  MediaResourceClient,
  PaginationParams,
  PaginatedResponse,
  SettingsResourceClient,
  UserRelation,
  UsersResourceClient,
  WordPressDeleteResult,
  ContentResourceClient,
  TermsResourceClient,
} from './types/resources.js';

export { ResourceItemQueryBuilder } from './builders/resource-item-relations.js';

export type {
  WordPressAbilityDescription,
  WordPressDiscoveryCatalog,
  WordPressDiscoveryOptions,
  WordPressDiscoveryWarning,
  WordPressJsonSchema,
  WordPressResourceDescription,
  WordPressResourceSchemaSet,
  WordPressAbilitySchemaSet,
} from './types/discovery.js';

export { filterToParams, compactPayload } from './core/params.js';
