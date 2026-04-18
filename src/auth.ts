import { createConfigError } from "./core/errors.js";

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
export type WordPressAuthConfig =
	| BasicAuthCredentials
	| JwtAuthCredentials
	| HeaderAuthCredentials
	| CookieNonceAuthCredentials;

/**
 * Auth input shape that can be translated into one Authorization header.
 */
export type WordPressAuthorizationInput =
	| string
	| BasicAuthCredentials
	| JwtAuthCredentials
	| HeaderAuthCredentials;

/**
 * Auth input that can be resolved into one Authorization header value.
 */
export type WordPressAuthInput = WordPressAuthConfig | string;

/**
 * Context-aware auth resolver for SSR and request-scoped auth handling.
 */
export type WordPressAuthResolver<TContext = void> = (
	context: TContext,
) =>
	| WordPressAuthInput
	| null
	| undefined
	| Promise<WordPressAuthInput | null | undefined>;

/**
 * Auth value that can be static or resolved per request from context.
 */
export type ResolvableWordPressAuth<TContext = void> =
	| WordPressAuthInput
	| WordPressAuthResolver<TContext>;

/**
 * Auth resolver for server handlers that receive a standard Request object.
 */
export type RequestAuthResolver = WordPressAuthResolver<Request>;

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
export type WordPressAuthHeadersProvider = (
	request: WordPressAuthRequest,
) => WordPressAuthHeaders | Promise<WordPressAuthHeaders>;

/**
 * Creates a typed auth resolver while preserving context inference.
 */
export function createAuthResolver<TContext>(
	resolver: WordPressAuthResolver<TContext>,
): WordPressAuthResolver<TContext> {
	return resolver;
}

/**
 * Identifies basic auth credentials from a generic auth union.
 */
function isBasicAuthCredentials(
	auth: WordPressAuthConfig,
): auth is BasicAuthCredentials {
	return "username" in auth && "password" in auth;
}

/**
 * Identifies JWT auth credentials from a generic auth union.
 */
function isJwtAuthCredentials(
	auth: WordPressAuthConfig,
): auth is JwtAuthCredentials {
	return "token" in auth;
}

/**
 * Identifies cookie + nonce auth credentials from a generic auth union.
 */
function isCookieNonceAuthCredentials(
	auth: WordPressAuthConfig,
): auth is CookieNonceAuthCredentials {
	return "nonce" in auth;
}

/**
 * Removes a bearer prefix from user-provided token values.
 */
function normalizeJwtToken(token: string): string {
	return token.trim().replace(/^Bearer\s+/i, "");
}

/**
 * Encodes a UTF-8 string to base64 with web-standard APIs.
 */
function encodeBase64(input: string): string {
	const bytes = new TextEncoder().encode(input);
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

/**
 * Validates and normalizes custom headers returned by auth providers.
 */
function normalizeAuthHeaders(
	headers: WordPressAuthHeaders,
): WordPressAuthHeaders {
	const normalizedHeaders: WordPressAuthHeaders = {};

	for (const [rawHeaderName, rawHeaderValue] of Object.entries(headers)) {
		const headerName = rawHeaderName.trim();

		if (!headerName) {
			throw createConfigError("Auth header name must not be empty.");
		}

		if (typeof rawHeaderValue !== "string") {
			throw createConfigError(`Auth header '${headerName}' must be a string.`);
		}

		const headerValue = rawHeaderValue.trim();

		if (!headerValue) {
			continue;
		}

		normalizedHeaders[headerName] = headerValue;
	}

	return normalizedHeaders;
}

/**
 * Creates a Basic Auth header from username/password credentials.
 */
export function createBasicAuthHeader(
	credentials: BasicAuthCredentials,
): string {
	const encoded = encodeBase64(
		`${credentials.username}:${credentials.password}`,
	);
	return `Basic ${encoded}`;
}

/**
 * Creates a Bearer Auth header from a WordPress JWT token.
 */
export function createJwtAuthHeader(
	credentials: JwtAuthCredentials | string,
): string {
	const token =
		typeof credentials === "string"
			? normalizeJwtToken(credentials)
			: normalizeJwtToken(credentials.token);

	if (!token) {
		throw createConfigError(
			"JWT token is required to build Authorization header.",
		);
	}

	return `Bearer ${token}`;
}

/**
 * Creates an Authorization header from any supported auth config shape.
 */
export function createWordPressAuthHeader(
	auth: WordPressAuthorizationInput,
): string {
	if (typeof auth === "string") {
		const header = auth.trim();

		if (!header) {
			throw createConfigError("Authorization header must not be empty.");
		}

		return header;
	}

	if (isBasicAuthCredentials(auth)) {
		return createBasicAuthHeader(auth);
	}

	if (isJwtAuthCredentials(auth)) {
		return createJwtAuthHeader(auth);
	}

	if (isCookieNonceAuthCredentials(auth)) {
		throw createConfigError(
			"Cookie nonce auth does not map to an Authorization header. Use resolveWordPressRequestHeaders instead.",
		);
	}

	const authorizationHeader = auth.authorization.trim();

	if (!authorizationHeader) {
		throw createConfigError("Authorization header must not be empty.");
	}

	return authorizationHeader;
}

/**
 * Resolves static or context-aware auth config to one concrete auth input.
 */
export async function resolveWordPressAuth<TContext>(
	auth: ResolvableWordPressAuth<TContext> | undefined,
	context: TContext,
): Promise<WordPressAuthInput | null> {
	if (!auth) {
		return null;
	}

	if (typeof auth !== "function") {
		return auth;
	}

	const resolvedAuth = await auth(context);

	if (!resolvedAuth) {
		return null;
	}

	return resolvedAuth;
}

/**
 * Resolves final request headers from static auth and request-aware providers.
 */
export async function resolveWordPressRequestHeaders(config: {
	auth?: WordPressAuthInput | null;
	authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider | null;
	request: WordPressAuthRequest;
}): Promise<WordPressAuthHeaders> {
	const resolvedHeaders: WordPressAuthHeaders = {};

	if (config.auth) {
		if (
			typeof config.auth !== "string" &&
			isCookieNonceAuthCredentials(config.auth)
		) {
			const nonce = config.auth.nonce.trim();

			if (!nonce) {
				throw createConfigError(
					"Cookie nonce auth requires a non-empty nonce value.",
				);
			}

			resolvedHeaders["X-WP-Nonce"] = nonce;
		} else {
			resolvedHeaders.Authorization = createWordPressAuthHeader(config.auth);
		}
	}

	if (!config.authHeaders) {
		return resolvedHeaders;
	}

	const providedHeaders =
		typeof config.authHeaders === "function"
			? await config.authHeaders(config.request)
			: config.authHeaders;

	return {
		...resolvedHeaders,
		...normalizeAuthHeaders(providedHeaders),
	};
}

/**
 * Resolves the fetch credentials mode from explicit options and auth config.
 */
export function resolveWordPressRequestCredentials(config: {
	auth?: WordPressAuthInput | null;
	credentials?: RequestCredentials | null;
}): RequestCredentials | undefined {
	if (config.credentials) {
		return config.credentials;
	}

	if (!config.auth || typeof config.auth === "string") {
		return undefined;
	}

	if (!isCookieNonceAuthCredentials(config.auth)) {
		return undefined;
	}

	return config.auth.credentials ?? "include";
}
