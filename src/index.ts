/**
 * Public exports for the standalone WordPress client package.
 */

export {
  type DeleteAbilityInput,
  type GetAbilityInput,
  type RunAbilityInput,
  WordPressAbilityBuilder,
  type WordPressAbilityRuntime,
} from "./abilities.js";
export {
  type BasicAuthCredentials,
  type CookieNonceAuthCredentials,
  createAuthResolver,
  createBasicAuthHeader,
  createJwtAuthHeader,
  createWordPressAuthHeader,
  type HeaderAuthCredentials,
  type JwtAuthCredentials,
  type JwtAuthTokenResponse,
  type JwtAuthValidationResponse,
  type JwtLoginCredentials,
  type RequestAuthResolver,
  type ResolvableWordPressAuth,
  resolveWordPressAuth,
  resolveWordPressRequestCredentials,
  resolveWordPressRequestHeaders,
  type WordPressAuthConfig,
  type WordPressAuthHeaders,
  type WordPressAuthHeadersProvider,
  type WordPressAuthInput,
  type WordPressAuthorizationInput,
  type WordPressAuthRequest,
  type WordPressAuthResolver,
} from "./auth.js";
// Content item query builder for awaitable single-item access
export { ContentItemQuery } from "./builders/content-item-query.js";
export {
  getCatalogSelectors,
  getQueryParams,
  getReadableFields,
  getWritableFields,
  type WordPressCatalogResourceKind,
  type WordPressCatalogSelectors,
} from "./catalog-helpers.js";
export { WordPressClient } from "./client.js";
export type { WordPressRawContentResult } from "./content-query.js";
// Embedded data extraction helpers
export {
  ACF_POSTS_EMBED_KEY,
  ACF_TERMS_EMBED_KEY,
  getAcfEmbeddedPosts,
  getAcfEmbeddedTerms,
  getAcfFieldId,
  getAcfFieldIds,
  getAcfFieldPost,
  getAcfFieldPosts,
  getAcfFieldTerms,
  getEmbeddableLinkKeys,
  getEmbeddedAuthor,
  getEmbeddedData,
  getEmbeddedFeaturedMedia,
  getEmbeddedParent,
  getEmbeddedReplies,
  getEmbeddedTerms,
  getLinkEntries,
  type WordPressLinkEntry,
} from "./core/embedded.js";
export {
  classifyFetchError,
  createAuthError,
  createConfigError,
  createDiscoveryError,
  createHttpError,
  createInvalidRequestError,
  createNetworkError,
  createParseError,
  createTimeoutError,
  isWordPressClientError,
  normalizeToClientError,
  type SchemaValidationIssue,
  throwIfHttpError,
  WordPressAuthError,
  WordPressClientError,
  type WordPressClientErrorKind,
  WordPressConfigError,
  WordPressDiscoveryError,
  type WordPressErrorContext,
  type WordPressErrorPayload,
  WordPressHttpError,
  WordPressInvalidRequestError,
  WordPressNetworkError,
  WordPressParseError,
  WordPressTimeoutError,
} from "./core/errors.js";
export {
  normalizeWordPressResponse,
  normalizeWordPressString,
} from "./core/normalize-response.js";
export {
  createWordPressPaginator,
  type WordPressPaginatorOptions,
} from "./core/pagination.js";
export {
  compactPayload,
  filterToParams,
  normalizeDeleteResult,
} from "./core/params.js";

export {
  type BuilderReturnType,
  createExecutableBuilder,
  ExecutableQuery,
  ImmutableBuilder,
  type WordPressQueryState,
} from "./core/query-base.js";
// Export core base classes
export {
  BaseCollectionResource,
  BaseCrudResource,
  BasePostLikeResource,
  type CrudResourceContext,
  type PostLikeResourceContext,
  type ResourceContext,
} from "./core/resource-base.js";
export {
  createRuntime,
  type WordPressRuntime,
  WordPressTransport,
  type WordPressTransportConfig,
} from "./core/transport.js";
export {
  isStandardSchema,
  type WordPressSchemaIssue,
  type WordPressStandardSchema,
} from "./core/validation.js";
export {
  createDiscoveryMethods,
  type DiscoveryMethods,
} from "./discovery.js";
export { CommentsResource } from "./resources/comments.js";
export { MediaResource } from "./resources/media.js";
export {
  type GenericResourceContext,
  GenericResourceRegistry,
} from "./resources/registry.js";
export { SettingsResource } from "./resources/settings.js";
export { UsersResource } from "./resources/users.js";
export type {
  WordPressAbility,
  WordPressAbilityAnnotations,
  WordPressAbilityCategory,
  WordPressAuthor,
  WordPressBase,
  WordPressCategory,
  WordPressComment,
  WordPressContent,
  WordPressCustomPost,
  WordPressEmbeddedMedia,
  WordPressError,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressPostBase,
  WordPressPostLike,
  WordPressPostWriteBase,
  WordPressPostWriteFields,
  WordPressSearchResult,
  WordPressSettings,
  WordPressTag,
} from "./schemas.js";
export {
  abilityAnnotationsSchema,
  abilityCategorySchema,
  abilitySchema,
  authorSchema,
  baseWordPressSchema,
  categorySchema,
  commentSchema,
  contentWordPressSchema,
  deleteAbilityInputSchema,
  embeddedMediaSchema,
  getAbilityInputSchema,
  jwtAuthErrorResponseSchema,
  jwtAuthTokenResponseSchema,
  jwtAuthValidationResponseSchema,
  mediaSchema,
  pageSchema,
  postLikeWordPressSchema,
  postSchema,
  postWriteBaseSchema,
  runAbilityInputSchema,
  searchResultSchema,
  settingsSchema,
  tagSchema,
  updatePostFieldsSchema,
  wordPressErrorSchema,
} from "./standard-schemas.js";
export type {
  WordPressAbilityDescription,
  WordPressAbilitySchemaSet,
  WordPressDiscoveryCatalog,
  WordPressDiscoveryOptions,
  WordPressDiscoveryWarning,
  WordPressJsonSchema,
  WordPressResourceCapabilities,
  WordPressResourceDescription,
  WordPressResourceSchemaSet,
} from "./types/discovery.js";
export type {
  BaseContentFilter,
  CategoriesFilter,
  CommentsFilter,
  EmbeddableContentFilter,
  MediaFilter,
  PagesFilter,
  PostsFilter,
  SearchFilter,
  TagsFilter,
  UsersFilter,
} from "./types/filters.js";
export type {
  CommentsResourceClient,
  ContentResourceClient,
  DeleteOptions,
  ExtensibleFilter,
  FetchResult,
  MediaResourceClient,
  PaginatedResponse,
  PaginationParams,
  QueryParamPrimitive,
  QueryParams,
  SerializedQueryParams,
  SettingsResourceClient,
  TermsResourceClient,
  TermWriteInput,
  UserDeleteOptions,
  UsersResourceClient,
  UserWriteInput,
  WordPressClientConfig,
  WordPressDeleteResult,
  WordPressMediaUploadInput,
  WordPressRequestOptions,
  WordPressRequestOverrides,
  WordPressRequestResult,
  WordPressResourceSchemaName,
  WordPressSchemaValueOptions,
  WordPressWritePayload,
} from "./types.js";
