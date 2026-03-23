/**
 * Public exports for the standalone WordPress client package.
 */
export {
  WordPressClient,
  type WordPressClientConfig,
  type WordPressRequestOptions,
  type WordPressRequestOverrides,
  type WordPressRequestResult,
  type WordPressMediaUploadInput,
  type WordPressNamespaceClient,
  type BaseContentFilter,
  type CategoriesFilter,
  type CommentsFilter,
  type MediaFilter,
  type PagesFilter,
  type PostsFilter,
  type SearchFilter,
  type TagsFilter,
  type UsersFilter,
} from './client.js';

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
