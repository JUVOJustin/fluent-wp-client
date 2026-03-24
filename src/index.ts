/**
 * Public exports for the standalone WordPress client package.
 */
export {
  WordPressClient,
  type WordPressNamespaceClient,
} from './client.js';

export { PostsResource } from './resources/posts.js';
export { PagesResource } from './resources/pages.js';
export { MediaResource } from './resources/media.js';
export { CategoriesResource } from './resources/categories.js';
export { TagsResource } from './resources/tags.js';
export { UsersResource } from './resources/users.js';
export { CommentsResource } from './resources/comments.js';
export { SettingsResource } from './resources/settings.js';

export {
  GenericResourceRegistry,
  type GenericResourceContext,
} from './resources/content-terms.js';

// Export core base classes
export {
  BaseCollectionResource,
  BaseCrudResource,
  BasePostLikeResource,
  type CrudResourceContext,
  type ResourceContext,
  type PostLikeResourceContext,
} from './core/resource-base.js';

export {
  WordPressTransport,
  createRuntime,
  type WordPressRuntime,
  type WordPressTransportConfig,
} from './core/transport.js';

export {
  ExecutableQuery,
  ImmutableBuilder,
  createExecutableBuilder,
  type WordPressQueryState,
  type BuilderReturnType,
} from './core/query-base.js';

export type {
  WordPressClientConfig,
  WordPressRequestOptions,
  WordPressRequestOverrides,
  WordPressRequestResult,
  WordPressMediaUploadInput,
} from './types.js';

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
} from './types/filters.js';

export {
  WordPressAbilityBuilder,
  type WordPressAbilityRuntime,
  type GetAbilityInput,
  type RunAbilityInput,
  type DeleteAbilityInput,
} from './abilities.js';

export {
  WordPressRequestBuilder,
  type WordPressRequestDeleteOptions,
} from './builders/wpapi-request.js';

export {
  createBasicAuthHeader,
  createJwtAuthHeader,
  createWordPressAuthHeader,
  resolveWordPressAuth,
  resolveWordPressRequestCredentials,
  resolveWordPressRequestHeaders,
  type BasicAuthCredentials,
  type CookieNonceAuthCredentials,
  type HeaderAuthCredentials,
  type JwtAuthCredentials,
  type JwtAuthTokenResponse,
  type JwtAuthValidationResponse,
  type JwtLoginCredentials,
  type RequestAuthResolver,
  type ResolvableWordPressAuth,
  type WordPressAuthorizationInput,
  type WordPressAuthConfig,
  type WordPressAuthHeaders,
  type WordPressAuthHeadersProvider,
  type WordPressAuthInput,
  type WordPressAuthRequest,
  type WordPressAuthResolver,
  createAuthResolver,
} from './auth.js';

export {
  WordPressSchemaValidationError,
  isStandardSchema,
  type WordPressSchemaIssue,
  type WordPressStandardSchema,
} from './core/validation.js';

export {
  WordPressApiError,
  createWordPressApiError,
  throwIfWordPressError,
  type WordPressErrorPayload,
} from './core/errors.js';

export {
  getAbilityInputSchema,
  runAbilityInputSchema,
  deleteAbilityInputSchema,
  baseWordPressSchema,
  postLikeWordPressSchema,
  contentWordPressSchema,
  postSchema,
  pageSchema,
  mediaSchema,
  categorySchema,
  tagSchema,
  embeddedMediaSchema,
  abilityAnnotationsSchema,
  abilitySchema,
  abilityCategorySchema,
  authorSchema,
  commentSchema,
  updatePostFieldsSchema,
  postWriteBaseSchema,
  jwtAuthTokenResponseSchema,
  jwtAuthErrorResponseSchema,
  jwtAuthValidationResponseSchema,
  wordPressErrorSchema,
  settingsSchema,
  searchResultSchema,
} from './standard-schemas.js';

export type {
  WordPressAuthor,
  WordPressBase,
  WordPressCategory,
  WordPressComment,
  WordPressContent,
  WordPressCustomPost,
  WordPressEmbeddedMedia,
  WordPressError,
  WordPressAbilityAnnotations,
  WordPressAbility,
  WordPressAbilityCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPostLike,
  WordPressPostBase,
  WordPressPost,
  WordPressPostWriteBase,
  WordPressPostWriteFields,
  WordPressSearchResult,
  WordPressSettings,
  WordPressTag,
} from './schemas.js';

export {
  filterToParams,
  compactPayload,
  normalizeDeleteResult,
} from './core/params.js';

export type {
  ContentResourceClient,
  DeleteOptions,
  ExtensibleFilter,
  FetchResult,
  PaginatedResponse,
  PaginationParams,
  QueryParamPrimitive,
  QueryParams,
  SerializedQueryParams,
  TermsResourceClient,
  TermWriteInput,
  UserDeleteOptions,
  UserWriteInput,
  WordPressDeleteResult,
  WordPressWritePayload,
} from './types.js';

export {
  PostRelationQueryBuilder,
  type PostRelation,
  type SelectedPostRelations,
  type AllPostRelations,
  customRelationRegistry,
  createArrayExtractor,
  createSingleExtractor,
  createIdCollectionRelation,
  createIdSingleRelation,
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
  defaultParseLinkId,
  defaultParseReferenceId,
  extractEmbeddedData,
  getEmbeddedRelationItems,
  getLinkedRelationIds,
  resolveContentReference,
  resolveContentReferences,
  resolvePostReference,
  resolvePostReferences,
  resolveTermReference,
  resolveTermReferences,
  toRelatedContentReference,
  toRelatedPostReference,
  toRelatedTermReference,
  type CustomRelationConfig,
  type CustomRelationRegistry,
  type PostRelationClient,
  type EmbeddedDataExtractor,
  type RelationFallbackResolver,
  type IdCollectionRelationOptions,
  type IdSingleRelationOptions,
  type LinkedEmbeddedCollectionRelationOptions,
  type LinkedEmbeddedSingleRelationOptions,
  type RelatedContentReference,
  type RelatedPostReference,
  type RelatedTermReference,
} from './builders/relations.js';

export {
  createAcfRelationshipRelation,
  createAcfPostObjectRelation,
  getAcfLinkedPostIds,
  getAcfEmbeddedPosts,
  getAcfLinkedTermIds,
  getAcfEmbeddedTerms,
  createAcfTaxonomyRelation,
  DEFAULT_ACF_POSTS_LINK_KEY,
  DEFAULT_ACF_TERMS_LINK_KEY,
  type AcfRelatedContent,
  type AcfRelatedTerm,
  type AcfRelationOptions,
  type AcfContentRelationOptions,
  type AcfPostObjectRelationOptions,
  type AcfTaxonomyRelationOptions,
} from './builders/acf-relations.js';

export {
  WordPressContentQuery,
  type WordPressGetBlocksOptions,
  type WordPressRawContentResult,
} from './content-query.js';

export {
  loadDefaultWordPressBlockParser,
  parseWordPressBlocks,
  type WordPressBlockParser,
  type WordPressParsedBlock,
} from './blocks.js';

export {
  createWordPressPaginator,
  type WordPressPaginatorOptions,
} from './core/pagination.js';
