/**
 * Minimal shape for WordPress REST API error payloads.
 */
export interface WordPressErrorPayload {
    code?: string;
    message?: string;
    data?: {
        status?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Structured error class used for failed WordPress API responses.
 */
export declare class WordPressApiError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly code: string | null;
    readonly responseBody: unknown;
    constructor(config: {
        status: number;
        statusText: string;
        message: string;
        code?: string | null;
        responseBody?: unknown;
    });
}
/**
 * Builds one typed `WordPressApiError` from a failed response and payload.
 */
export declare function createWordPressApiError(response: Response, payload: unknown): WordPressApiError;
/**
 * Throws a typed API error when the response status indicates failure.
 */
export declare function throwIfWordPressError(response: Response, payload: unknown): void;
