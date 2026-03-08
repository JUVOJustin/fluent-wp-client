/**
 * Basic authentication credentials for WordPress API calls.
 */
export interface BasicAuthCredentials {
    username: string;
    password: string;
}
/**
 * JWT authentication token for WordPress API calls.
 */
export interface JwtAuthCredentials {
    token: string;
}
/**
 * Prebuilt Authorization header value for advanced authentication flows.
 */
export interface HeaderAuthCredentials {
    authorization: string;
}
/**
 * Cookie + nonce authentication settings for browser-based WP REST requests.
 */
export interface CookieNonceAuthCredentials {
    nonce: string;
    credentials?: RequestCredentials;
}
/**
 * Credentials used for exchanging username/password for a JWT token.
 */
export interface JwtLoginCredentials {
    username: string;
    password: string;
}
/**
 * Successful JWT token response returned by the WP JWT plugin endpoint.
 */
export interface JwtAuthTokenResponse {
    token: string;
    user_email?: string;
    user_nicename?: string;
    user_display_name?: string;
    [key: string]: unknown;
}
/**
 * JWT token validation response from `/jwt-auth/v1/token/validate`.
 */
export interface JwtAuthValidationResponse {
    code?: string;
    data?: {
        status?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Supported static authentication config shapes accepted by the client.
 */
export type WordPressAuthConfig = BasicAuthCredentials | JwtAuthCredentials | HeaderAuthCredentials | CookieNonceAuthCredentials;
/**
 * Auth input shape that can be translated into one Authorization header.
 */
export type WordPressAuthorizationInput = string | BasicAuthCredentials | JwtAuthCredentials | HeaderAuthCredentials;
/**
 * Auth input that can be resolved into one Authorization header value.
 */
export type WordPressAuthInput = WordPressAuthConfig | string;
/**
 * Context-aware auth resolver for SSR and request-scoped auth handling.
 */
export type WordPressAuthResolver<TContext = void> = (context: TContext) => WordPressAuthInput | null | undefined | Promise<WordPressAuthInput | null | undefined>;
/**
 * Auth value that can be static or resolved per request from context.
 */
export type ResolvableWordPressAuth<TContext = void> = WordPressAuthInput | WordPressAuthResolver<TContext>;
/**
 * Normalized request details passed to advanced auth header providers.
 */
export interface WordPressAuthRequest {
    method: string;
    url: URL;
    body?: BodyInit;
}
/**
 * Generic HTTP headers map used by advanced authentication flows.
 */
export type WordPressAuthHeaders = Record<string, string>;
/**
 * Request-aware auth header provider for signature-based auth methods.
 */
export type WordPressAuthHeadersProvider = (request: WordPressAuthRequest) => WordPressAuthHeaders | Promise<WordPressAuthHeaders>;
/**
 * Creates a Basic Auth header from username/password credentials.
 */
export declare function createBasicAuthHeader(credentials: BasicAuthCredentials): string;
/**
 * Creates a Bearer Auth header from a WordPress JWT token.
 */
export declare function createJwtAuthHeader(credentials: JwtAuthCredentials | string): string;
/**
 * Creates an Authorization header from any supported auth config shape.
 */
export declare function createWordPressAuthHeader(auth: WordPressAuthorizationInput): string;
/**
 * Resolves static or context-aware auth config to one concrete auth input.
 */
export declare function resolveWordPressAuth<TContext>(auth: ResolvableWordPressAuth<TContext> | undefined, context: TContext): Promise<WordPressAuthInput | null>;
/**
 * Resolves final request headers from static auth and request-aware providers.
 */
export declare function resolveWordPressRequestHeaders(config: {
    auth?: WordPressAuthInput | null;
    authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider | null;
    request: WordPressAuthRequest;
}): Promise<WordPressAuthHeaders>;
/**
 * Resolves the fetch credentials mode from explicit options and auth config.
 */
export declare function resolveWordPressRequestCredentials(config: {
    auth?: WordPressAuthInput | null;
    credentials?: RequestCredentials | null;
}): RequestCredentials | undefined;
