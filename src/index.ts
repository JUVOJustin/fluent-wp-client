/**
 * Public exports for the standalone WordPress client package.
 */
export {
  WordPressClient,
  type WordPressClientConfig,
  type WordPressRequestOptions,
  type WordPressRequestResult,
  type WordPressMediaUploadInput,
  type WordPressNamespaceClient,
  type CategoriesFilter,
  type CommentsFilter,
  type MediaFilter,
  type PagesFilter,
  type PostsFilter,
  type TagsFilter,
  type UsersFilter,
} from './client.js';

export {
  WordPressAbilityBuilder,
  getAbilityInputSchema,
  runAbilityInputSchema,
  deleteAbilityInputSchema,
  type WordPressAbilityRuntime,
  type GetAbilityInput,
  type RunAbilityInput,
  type DeleteAbilityInput,
} from './abilities.js';

export {
  WordPressRequestBuilder,
  type WordPressRequestDeleteOptions,
} from './wpapi-request.js';

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
  validateWithStandardSchema,
  type WordPressSchemaIssue,
  type WordPressStandardSchema,
} from './validation.js';

export {
  WordPressApiError,
  createWordPressApiError,
  throwIfWordPressError,
  type WordPressErrorPayload,
} from './errors.js';

export {
  baseWordPressSchema,
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
  wordPressErrorSchema,
  settingsSchema,
  type WordPressAuthor,
  type WordPressBase,
  type WordPressCategory,
  type WordPressComment,
  type WordPressContent,
  type WordPressCustomPost,
  type WordPressEmbeddedMedia,
  type WordPressError,
  type WordPressAbilityAnnotations,
  type WordPressAbility,
  type WordPressAbilityCategory,
  type WordPressMedia,
  type WordPressPage,
  type WordPressPostBase,
  type WordPressPost,
  type WordPressPostWriteBase,
  type WordPressPostWriteFields,
  type WordPressSettings,
  type WordPressTag,
} from './schemas.js';

export {
  filterToParams,
  compactPayload,
  type ContentResourceClient,
  type DeleteOptions,
  type FetchResult,
  type PaginatedResponse,
  type PaginationParams,
  type QueryParamPrimitive,
  type QueryParams,
  type TermsResourceClient,
  type TermWriteInput,
  type UserDeleteOptions,
  type UserWriteInput,
  type WordPressDeleteResult,
  type WordPressWritePayload,
} from './types.js';

export {
  PostRelationQueryBuilder,
  type PostRelation,
  type SelectedPostRelations,
} from './relations.js';

export {
  WordPressContentQuery,
  createWordPressContentRecord,
  type WordPressGetBlocksOptions,
  type WordPressContentMethods,
  type WordPressContentRecord,
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
} from './pagination.js';
