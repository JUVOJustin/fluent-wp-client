/**
 * Public exports that expose native Zod schema objects.
 */
export {
  WordPressClient,
} from './client.js';

export type {
  WordPressClientConfig,
  WordPressRequestOptions,
  WordPressRequestOverrides,
  WordPressRequestResult,
  WordPressMediaUploadInput,
} from './types.js';

export type {
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
  zodGetAbilityInputSchema as getAbilityInputSchema,
  zodRunAbilityInputSchema as runAbilityInputSchema,
  zodDeleteAbilityInputSchema as deleteAbilityInputSchema,
  type WordPressAbilityRuntime,
  type GetAbilityInput,
  type RunAbilityInput,
  type DeleteAbilityInput,
} from './abilities.js';

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
  type WordPressPostLike,
  type WordPressPostBase,
  type WordPressPost,
  type WordPressPostWriteBase,
  type WordPressPostWriteFields,
  type WordPressSearchResult,
  type WordPressSettings,
  type WordPressTag,
} from './schemas.js';

export {
  filterToParams,
  compactPayload,
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
  type ContentItemResult,
  type PostRelation,
  type SelectedPostRelations,
} from './builders/relations.js';

export { type WordPressRawContentResult } from './content-query.js';

export {
  createWordPressPaginator,
  type WordPressPaginatorOptions,
} from './core/pagination.js';

export {
  zodFromJsonSchema,
  zodSchemasFromDescription,
  stripDateTimeFormats,
  type ResourceZodSchemas,
  type AbilityZodSchemas,
} from './zod-helpers.js';
