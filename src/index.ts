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
  WordPressPostBase,
  WordPressPost,
  WordPressPostWriteBase,
  WordPressPostWriteFields,
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
  FetchResult,
  PaginatedResponse,
  PaginationParams,
  QueryParamPrimitive,
  QueryParams,
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
} from './builders/relations.js';

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
