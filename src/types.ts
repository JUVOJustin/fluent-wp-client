/**
 * Re-exports all type definitions and runtime utilities from their organized locations.
 *
 * Internal source modules should import from specific paths (types/filters, types/payloads, etc.)
 * but this barrel ensures backward compatibility for existing consumer imports.
 */

export { compactPayload, filterToParams } from "./core/params.js";
// Client configuration and request types
export type {
	WordPressClientConfig,
	WordPressMediaUploadInput,
	WordPressRequestOptions,
	WordPressRequestResult,
} from "./types/client.js";
export type {
	WordPressAbilityDescription,
	WordPressAbilitySchemaSet,
	WordPressDiscoveryCatalog,
	WordPressDiscoveryOptions,
	WordPressDiscoveryWarning,
	WordPressJsonSchema,
	WordPressResourceDescription,
	WordPressResourceSchemaSet,
} from "./types/discovery.js";
// Filter types
export type {
	BaseContentFilter,
	CategoriesFilter,
	CommentsFilter,
	MediaFilter,
	PagesFilter,
	PostsFilter,
	SearchFilter,
	TagsFilter,
	UsersFilter,
} from "./types/filters.js";
// Payload types
export type {
	DeleteOptions,
	TermWriteInput,
	UserDeleteOptions,
	UserWriteInput,
	WordPressWritePayload,
} from "./types/payloads.js";
// Request overrides (used across resources)
export type {
	CommentsResourceClient,
	ContentResourceClient,
	ExtensibleFilter,
	FetchResult,
	IncludeExcludeParam,
	MediaResourceClient,
	PaginatedResponse,
	PaginationParams,
	QueryParamPrimitive,
	QueryParams,
	QueryParamValue,
	SerializedQueryParams,
	SettingsResourceClient,
	TermsResourceClient,
	UsersResourceClient,
	WordPressDeleteResult,
	WordPressRequestOverrides,
} from "./types/resources.js";
