/**
 * Identifies basic auth credentials from a generic auth union.
 */
function isBasicAuthCredentials(auth) {
    return 'username' in auth && 'password' in auth;
}
/**
 * Identifies JWT auth credentials from a generic auth union.
 */
function isJwtAuthCredentials(auth) {
    return 'token' in auth;
}
/**
 * Identifies cookie + nonce auth credentials from a generic auth union.
 */
function isCookieNonceAuthCredentials(auth) {
    return 'nonce' in auth;
}
/**
 * Removes a bearer prefix from user-provided token values.
 */
function normalizeJwtToken(token) {
    return token.trim().replace(/^Bearer\s+/i, '');
}
/**
 * Encodes a UTF-8 string to base64 with web-standard APIs.
 */
function encodeBase64(input) {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}
/**
 * Validates and normalizes custom headers returned by auth providers.
 */
function normalizeAuthHeaders(headers) {
    const normalizedHeaders = {};
    for (const [rawHeaderName, rawHeaderValue] of Object.entries(headers)) {
        const headerName = rawHeaderName.trim();
        if (!headerName) {
            throw new Error('Auth header name must not be empty.');
        }
        if (typeof rawHeaderValue !== 'string') {
            throw new Error(`Auth header '${headerName}' must be a string.`);
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
export function createBasicAuthHeader(credentials) {
    const encoded = encodeBase64(`${credentials.username}:${credentials.password}`);
    return `Basic ${encoded}`;
}
/**
 * Creates a Bearer Auth header from a WordPress JWT token.
 */
export function createJwtAuthHeader(credentials) {
    const token = typeof credentials === 'string'
        ? normalizeJwtToken(credentials)
        : normalizeJwtToken(credentials.token);
    if (!token) {
        throw new Error('JWT token is required to build Authorization header.');
    }
    return `Bearer ${token}`;
}
/**
 * Creates an Authorization header from any supported auth config shape.
 */
export function createWordPressAuthHeader(auth) {
    if (typeof auth === 'string') {
        const header = auth.trim();
        if (!header) {
            throw new Error('Authorization header must not be empty.');
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
        throw new Error('Cookie nonce auth does not map to an Authorization header. Use resolveWordPressRequestHeaders instead.');
    }
    const authorizationHeader = auth.authorization.trim();
    if (!authorizationHeader) {
        throw new Error('Authorization header must not be empty.');
    }
    return authorizationHeader;
}
/**
 * Resolves static or context-aware auth config to one concrete auth input.
 */
export async function resolveWordPressAuth(auth, context) {
    if (!auth) {
        return null;
    }
    if (typeof auth !== 'function') {
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
export async function resolveWordPressRequestHeaders(config) {
    const resolvedHeaders = {};
    if (config.auth) {
        if (typeof config.auth !== 'string' && isCookieNonceAuthCredentials(config.auth)) {
            const nonce = config.auth.nonce.trim();
            if (!nonce) {
                throw new Error('Cookie nonce auth requires a non-empty nonce value.');
            }
            resolvedHeaders['X-WP-Nonce'] = nonce;
        }
        else {
            resolvedHeaders.Authorization = createWordPressAuthHeader(config.auth);
        }
    }
    if (!config.authHeaders) {
        return resolvedHeaders;
    }
    const providedHeaders = typeof config.authHeaders === 'function'
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
export function resolveWordPressRequestCredentials(config) {
    if (config.credentials) {
        return config.credentials;
    }
    if (!config.auth || typeof config.auth === 'string') {
        return undefined;
    }
    if (!isCookieNonceAuthCredentials(config.auth)) {
        return undefined;
    }
    return config.auth.credentials ?? 'include';
}
