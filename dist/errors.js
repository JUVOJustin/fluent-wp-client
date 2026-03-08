/**
 * Structured error class used for failed WordPress API responses.
 */
export class WordPressApiError extends Error {
    status;
    statusText;
    code;
    responseBody;
    constructor(config) {
        super(config.message);
        this.name = 'WordPressApiError';
        this.status = config.status;
        this.statusText = config.statusText;
        this.code = config.code ?? null;
        this.responseBody = config.responseBody;
    }
}
/**
 * Safely narrows unknown payload values to the expected WP error shape.
 */
function toWordPressErrorPayload(payload) {
    if (typeof payload !== 'object' || payload === null) {
        return null;
    }
    return payload;
}
/**
 * Builds one typed `WordPressApiError` from a failed response and payload.
 */
export function createWordPressApiError(response, payload) {
    const wpError = toWordPressErrorPayload(payload);
    const status = wpError?.data?.status ?? response.status;
    const code = typeof wpError?.code === 'string' ? wpError.code : null;
    const message = typeof wpError?.message === 'string'
        ? wpError.message
        : `WordPress API error: ${response.status} ${response.statusText}`;
    return new WordPressApiError({
        status,
        statusText: response.statusText,
        message,
        code,
        responseBody: payload,
    });
}
/**
 * Throws a typed API error when the response status indicates failure.
 */
export function throwIfWordPressError(response, payload) {
    if (response.ok) {
        return;
    }
    throw createWordPressApiError(response, payload);
}
