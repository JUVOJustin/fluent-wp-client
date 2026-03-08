import { type JwtAuthCredentials, type JwtAuthTokenResponse, type JwtAuthValidationResponse, type JwtLoginCredentials } from './auth.js';
import { WordPressAbilityBuilder, createAbilityMethods } from './abilities.js';
import type { WordPressClientConfig, WordPressMediaUploadInput, WordPressRequestOptions, WordPressRequestResult } from './client-types.js';
import { createPostsMethods } from './posts.js';
import { createPagesMethods } from './pages.js';
import { createMediaMethods } from './media.js';
import { createCategoriesMethods } from './categories.js';
import { createTagsMethods } from './tags.js';
import { createUsersMethods } from './users.js';
import { createSettingsMethods } from './settings.js';
import { createCommentsMethods } from './comments.js';
import { createContentTermMethods } from './client-content-terms.js';
import { type WordPressAuthor, type WordPressCategory, type WordPressComment, type WordPressMedia, type WordPressPage, type WordPressPost, type WordPressPostWriteBase, type WordPressSettings, type WordPressTag } from './schemas.js';
import { PostRelationQueryBuilder, type PostRelation, type SelectedPostRelations } from './relations.js';
import { WordPressRequestBuilder } from './wpapi-request.js';
import { type WordPressStandardSchema } from './validation.js';
import { type CategoriesFilter, type CommentsFilter, type DeleteOptions, type FetchResult, type MediaFilter, type PagesFilter, type PostsFilter, type TagsFilter, type TermWriteInput, type UserDeleteOptions, type UsersFilter, type UserWriteInput, type WordPressDeleteResult, type WordPressWritePayload } from './types.js';
export type { WordPressClientConfig, WordPressRequestOptions, WordPressRequestResult, WordPressMediaUploadInput, } from './client-types.js';
/**
 * Namespace-scoped request factory for WPAPI-style route chaining.
 */
export interface WordPressNamespaceClient {
    route: <TResponse = unknown, TCreate extends Record<string, unknown> = Record<string, unknown>, TUpdate extends Record<string, unknown> = TCreate>(resource: string) => WordPressRequestBuilder<TResponse, TCreate, TUpdate>;
    resource: <TResponse = unknown, TCreate extends Record<string, unknown> = Record<string, unknown>, TUpdate extends Record<string, unknown> = TCreate>(resource: string) => WordPressRequestBuilder<TResponse, TCreate, TUpdate>;
}
/**
 * Runtime-agnostic WordPress API client with typed resources and CRUD helpers.
 */
export declare class WordPressClient {
    private readonly baseUrl;
    private readonly baseOrigin;
    private readonly apiBase;
    private readonly auth;
    private readonly authHeaders;
    private readonly cookieHeader;
    private readonly defaultHeaders;
    private readonly requestCredentials;
    private readonly fetcher;
    getPosts: ReturnType<typeof createPostsMethods>['getPosts'];
    getAllPosts: ReturnType<typeof createPostsMethods>['getAllPosts'];
    getPostsPaginated: ReturnType<typeof createPostsMethods>['getPostsPaginated'];
    getPost: ReturnType<typeof createPostsMethods>['getPost'];
    getPostBySlug: ReturnType<typeof createPostsMethods>['getPostBySlug'];
    getPages: ReturnType<typeof createPagesMethods>['getPages'];
    getAllPages: ReturnType<typeof createPagesMethods>['getAllPages'];
    getPagesPaginated: ReturnType<typeof createPagesMethods>['getPagesPaginated'];
    getPage: ReturnType<typeof createPagesMethods>['getPage'];
    getPageBySlug: ReturnType<typeof createPagesMethods>['getPageBySlug'];
    getMedia: ReturnType<typeof createMediaMethods>['getMedia'];
    getAllMedia: ReturnType<typeof createMediaMethods>['getAllMedia'];
    getMediaPaginated: ReturnType<typeof createMediaMethods>['getMediaPaginated'];
    getMediaItem: ReturnType<typeof createMediaMethods>['getMediaItem'];
    getMediaBySlug: ReturnType<typeof createMediaMethods>['getMediaBySlug'];
    getImageUrl: ReturnType<typeof createMediaMethods>['getImageUrl'];
    getCategories: ReturnType<typeof createCategoriesMethods>['getCategories'];
    getAllCategories: ReturnType<typeof createCategoriesMethods>['getAllCategories'];
    getCategoriesPaginated: ReturnType<typeof createCategoriesMethods>['getCategoriesPaginated'];
    getCategory: ReturnType<typeof createCategoriesMethods>['getCategory'];
    getCategoryBySlug: ReturnType<typeof createCategoriesMethods>['getCategoryBySlug'];
    getTags: ReturnType<typeof createTagsMethods>['getTags'];
    getAllTags: ReturnType<typeof createTagsMethods>['getAllTags'];
    getTagsPaginated: ReturnType<typeof createTagsMethods>['getTagsPaginated'];
    getTag: ReturnType<typeof createTagsMethods>['getTag'];
    getTagBySlug: ReturnType<typeof createTagsMethods>['getTagBySlug'];
    getUsers: ReturnType<typeof createUsersMethods>['getUsers'];
    getAllUsers: ReturnType<typeof createUsersMethods>['getAllUsers'];
    getUsersPaginated: ReturnType<typeof createUsersMethods>['getUsersPaginated'];
    getUser: ReturnType<typeof createUsersMethods>['getUser'];
    getCurrentUser: ReturnType<typeof createUsersMethods>['getCurrentUser'];
    getSettings: ReturnType<typeof createSettingsMethods>['getSettings'];
    getComments: ReturnType<typeof createCommentsMethods>['getComments'];
    getAllComments: ReturnType<typeof createCommentsMethods>['getAllComments'];
    getCommentsPaginated: ReturnType<typeof createCommentsMethods>['getCommentsPaginated'];
    getComment: ReturnType<typeof createCommentsMethods>['getComment'];
    getContentCollection: ReturnType<typeof createContentTermMethods>['getContentCollection'];
    getAllContentCollection: ReturnType<typeof createContentTermMethods>['getAllContentCollection'];
    getContentCollectionPaginated: ReturnType<typeof createContentTermMethods>['getContentCollectionPaginated'];
    getContent: ReturnType<typeof createContentTermMethods>['getContent'];
    getContentBySlug: ReturnType<typeof createContentTermMethods>['getContentBySlug'];
    createContent: ReturnType<typeof createContentTermMethods>['createContent'];
    updateContent: ReturnType<typeof createContentTermMethods>['updateContent'];
    deleteContent: ReturnType<typeof createContentTermMethods>['deleteContent'];
    getTermCollection: ReturnType<typeof createContentTermMethods>['getTermCollection'];
    getAllTermCollection: ReturnType<typeof createContentTermMethods>['getAllTermCollection'];
    getTermCollectionPaginated: ReturnType<typeof createContentTermMethods>['getTermCollectionPaginated'];
    getTerm: ReturnType<typeof createContentTermMethods>['getTerm'];
    getTermBySlug: ReturnType<typeof createContentTermMethods>['getTermBySlug'];
    createTerm: ReturnType<typeof createContentTermMethods>['createTerm'];
    updateTerm: ReturnType<typeof createContentTermMethods>['updateTerm'];
    deleteTerm: ReturnType<typeof createContentTermMethods>['deleteTerm'];
    content: ReturnType<typeof createContentTermMethods>['content'];
    terms: ReturnType<typeof createContentTermMethods>['terms'];
    getAbilities: ReturnType<typeof createAbilityMethods>['getAbilities'];
    getAbility: ReturnType<typeof createAbilityMethods>['getAbility'];
    getAbilityCategories: ReturnType<typeof createAbilityMethods>['getAbilityCategories'];
    getAbilityCategory: ReturnType<typeof createAbilityMethods>['getAbilityCategory'];
    executeGetAbility: ReturnType<typeof createAbilityMethods>['executeGetAbility'];
    executeRunAbility: ReturnType<typeof createAbilityMethods>['executeRunAbility'];
    executeDeleteAbility: ReturnType<typeof createAbilityMethods>['executeDeleteAbility'];
    constructor(config: WordPressClientConfig);
    /**
     * Rejects absolute URLs that do not target the configured WordPress origin.
     */
    private createAbsoluteApiUrl;
    /**
     * Builds one REST URL from endpoint and query params.
     */
    private createApiUrl;
    /**
     * Resolves one endpoint and params pair into an absolute URL string.
     */
    private createApiUrlString;
    /**
     * Normalizes a namespace + resource pair to one request endpoint.
     */
    private createNamespacedEndpoint;
    /**
     * Serializes request body input to one final body value.
     */
    private serializeBody;
    /**
     * Checks whether one header name exists in a header map.
     */
    private hasHeader;
    /**
     * Resolves final request headers from auth, cookies, and caller-provided headers.
     */
    private resolveRequestHeaders;
    /**
     * Parses one REST response payload based on returned content type.
     */
    private parseResponseBody;
    /**
     * Returns whether authentication is configured on this client instance.
     */
    hasAuth(): boolean;
    /**
     * Sets headers used by all subsequent requests from this client instance.
     */
    setHeaders(name: string, value: string): this;
    setHeaders(headers: Record<string, string>): this;
    /**
     * Executes one low-level WordPress request and returns payload + response metadata.
     */
    request<T = unknown>(options: WordPressRequestOptions): Promise<WordPressRequestResult<T>>;
    /**
     * Fetches typed data from one WordPress REST endpoint.
     */
    fetchAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T>;
    /**
     * Fetches typed data and pagination metadata from one REST endpoint.
     */
    fetchAPIPaginated<T>(endpoint: string, params?: Record<string, string>): Promise<FetchResult<T>>;
    /**
     * Executes one mutation request and optionally parses response data with a schema.
     */
    private executeMutation;
    /**
     * Creates one post with typed schema parsing.
     */
    createPost<TPost = WordPressPost>(input: WordPressPostWriteBase & Record<string, unknown>, responseSchema?: WordPressStandardSchema<TPost>): Promise<TPost>;
    /**
     * Updates one post with typed schema parsing.
     */
    updatePost<TPost = WordPressPost>(id: number, input: WordPressPostWriteBase & Record<string, unknown>, responseSchema?: WordPressStandardSchema<TPost>): Promise<TPost>;
    /**
     * Deletes one post.
     */
    deletePost(id: number, options?: DeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Creates one page with typed schema parsing.
     */
    createPage<TPage = WordPressPage>(input: WordPressPostWriteBase & Record<string, unknown>, responseSchema?: WordPressStandardSchema<TPage>): Promise<TPage>;
    /**
     * Updates one page with typed schema parsing.
     */
    updatePage<TPage = WordPressPage>(id: number, input: WordPressPostWriteBase & Record<string, unknown>, responseSchema?: WordPressStandardSchema<TPage>): Promise<TPage>;
    /**
     * Deletes one page.
     */
    deletePage(id: number, options?: DeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Creates one category with typed schema parsing.
     */
    createCategory<TCategory = WordPressCategory>(input: TermWriteInput, responseSchema?: WordPressStandardSchema<TCategory>): Promise<TCategory>;
    /**
     * Updates one category with typed schema parsing.
     */
    updateCategory<TCategory = WordPressCategory>(id: number, input: TermWriteInput, responseSchema?: WordPressStandardSchema<TCategory>): Promise<TCategory>;
    /**
     * Deletes one category.
     */
    deleteCategory(id: number, options?: DeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Creates one tag with typed schema parsing.
     */
    createTag<TTag = WordPressTag>(input: TermWriteInput, responseSchema?: WordPressStandardSchema<TTag>): Promise<TTag>;
    /**
     * Updates one tag with typed schema parsing.
     */
    updateTag<TTag = WordPressTag>(id: number, input: TermWriteInput, responseSchema?: WordPressStandardSchema<TTag>): Promise<TTag>;
    /**
     * Deletes one tag.
     */
    deleteTag(id: number, options?: DeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Creates one user.
     */
    createUser<TUser = WordPressAuthor>(input: UserWriteInput, responseSchema?: WordPressStandardSchema<TUser>): Promise<TUser>;
    /**
     * Updates one user.
     */
    updateUser<TUser = WordPressAuthor>(id: number, input: UserWriteInput, responseSchema?: WordPressStandardSchema<TUser>): Promise<TUser>;
    /**
     * Deletes one user.
     */
    deleteUser(id: number, options?: UserDeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Creates one comment.
     */
    createComment<TComment = WordPressComment>(input: WordPressWritePayload, responseSchema?: WordPressStandardSchema<TComment>): Promise<TComment>;
    /**
     * Updates one comment.
     */
    updateComment<TComment = WordPressComment>(id: number, input: WordPressWritePayload, responseSchema?: WordPressStandardSchema<TComment>): Promise<TComment>;
    /**
     * Deletes one comment.
     */
    deleteComment(id: number, options?: DeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Creates one media record from a JSON payload.
     */
    createMedia<TMedia = WordPressMedia>(input: WordPressWritePayload, responseSchema?: WordPressStandardSchema<TMedia>): Promise<TMedia>;
    /**
     * Uploads one binary media file and optionally applies metadata.
     */
    uploadMedia(input: WordPressMediaUploadInput): Promise<WordPressMedia>;
    /**
     * Updates one media record.
     */
    updateMedia<TMedia = WordPressMedia>(id: number, input: WordPressWritePayload, responseSchema?: WordPressStandardSchema<TMedia>): Promise<TMedia>;
    /**
     * Deletes one media record.
     */
    deleteMedia(id: number, options?: DeleteOptions): Promise<WordPressDeleteResult>;
    /**
     * Updates WordPress site settings.
     */
    updateSettings(input: Partial<WordPressSettings> & Record<string, unknown>): Promise<WordPressSettings>;
    /**
     * Performs username/password JWT login against the WP JWT plugin endpoint.
     */
    loginWithJwt(credentials: JwtLoginCredentials): Promise<JwtAuthTokenResponse>;
    /**
     * Validates one JWT token with the WP JWT plugin endpoint.
     */
    validateJwtToken(token?: string | JwtAuthCredentials): Promise<JwtAuthValidationResponse>;
    /**
     * Starts one fluent REST ability builder with optional input/output validation.
     */
    ability<TInput = unknown, TOutput = unknown>(name: string): WordPressAbilityBuilder<TInput, TOutput>;
    /**
     * Creates one WPAPI-style request builder for any REST namespace/resource pair.
     */
    route<TResponse = unknown, TCreate extends Record<string, unknown> = Record<string, unknown>, TUpdate extends Record<string, unknown> = TCreate>(resource: string, namespace?: string): WordPressRequestBuilder<TResponse, TCreate, TUpdate>;
    /**
     * Returns one namespace-scoped request factory for custom/plugin routes.
     */
    namespace(namespace: string): WordPressNamespaceClient;
    /**
     * Registers one route factory following node-wpapi style route declarations.
     */
    registerRoute(namespace: string, route: string): () => WordPressRequestBuilder<unknown, Record<string, unknown>, Record<string, unknown>>;
    /**
     * Starts one WPAPI-style posts request chain.
     */
    posts(): WordPressRequestBuilder<WordPressPost | WordPressPost[], WordPressPostWriteBase & Record<string, unknown>, WordPressPostWriteBase & Record<string, unknown>>;
    /**
     * Starts one WPAPI-style pages request chain.
     */
    pages(): WordPressRequestBuilder<WordPressPage | WordPressPage[], WordPressPostWriteBase & Record<string, unknown>, WordPressPostWriteBase & Record<string, unknown>>;
    /**
     * Starts one WPAPI-style media request chain.
     */
    media(): WordPressRequestBuilder<WordPressMedia | WordPressMedia[], WordPressWritePayload, WordPressWritePayload>;
    /**
     * Starts one WPAPI-style categories request chain.
     */
    categories(): WordPressRequestBuilder<WordPressCategory | WordPressCategory[], TermWriteInput, TermWriteInput>;
    /**
     * Starts one WPAPI-style tags request chain.
     */
    tags(): WordPressRequestBuilder<WordPressTag | WordPressTag[], TermWriteInput, TermWriteInput>;
    /**
     * Starts one WPAPI-style users request chain.
     */
    users(): WordPressRequestBuilder<WordPressAuthor | WordPressAuthor[], UserWriteInput, UserWriteInput>;
    /**
     * Starts one WPAPI-style comments request chain.
     */
    comments(): WordPressRequestBuilder<WordPressComment | WordPressComment[], WordPressWritePayload, WordPressWritePayload>;
    /**
     * Starts one WPAPI-style settings request chain.
     */
    settings(): WordPressRequestBuilder<WordPressSettings, Partial<WordPressSettings> & Record<string, unknown>>;
    /**
     * Starts one WPAPI-style post types request chain.
     */
    types(): WordPressRequestBuilder<unknown>;
    /**
     * Starts one WPAPI-style taxonomies request chain.
     */
    taxonomies(): WordPressRequestBuilder<unknown>;
    /**
     * Starts one WPAPI-style statuses request chain.
     */
    statuses(): WordPressRequestBuilder<unknown>;
    /**
     * Starts one WPAPI-style search request chain.
     */
    search(): WordPressRequestBuilder<unknown>;
    /**
     * Starts one WPAPI-style block request chain.
     */
    blocks(): WordPressRequestBuilder<unknown, WordPressWritePayload, WordPressWritePayload>;
    /**
     * Starts one fluent post relation query by ID or slug.
     */
    post(idOrSlug: number | string): PostRelationQueryBuilder<[]>;
    /**
     * Fetches one post and resolves selected related entities in one call.
     */
    getPostWithRelations<TRelations extends readonly PostRelation[]>(idOrSlug: number | string, ...relations: TRelations): Promise<WordPressPost & {
        related: SelectedPostRelations<TRelations>;
    }>;
}
/**
 * Re-export selected client filter types alongside the class implementation.
 */
export type { CategoriesFilter, CommentsFilter, MediaFilter, PagesFilter, PostsFilter, TagsFilter, UsersFilter, };
