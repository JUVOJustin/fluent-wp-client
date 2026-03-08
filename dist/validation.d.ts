import type { StandardSchemaV1 } from '@standard-schema/spec';
/**
 * Shared schema type accepted by client mutation helpers.
 */
export type WordPressStandardSchema<TOutput = unknown, TInput = unknown> = StandardSchemaV1<TInput, TOutput>;
/**
 * Validation issue shape returned by Standard Schema validators.
 */
export type WordPressSchemaIssue = StandardSchemaV1.Issue;
/**
 * Error thrown when one Standard Schema validator reports issues.
 */
export declare class WordPressSchemaValidationError extends Error {
    readonly issues: readonly WordPressSchemaIssue[];
    constructor(message: string, issues: readonly WordPressSchemaIssue[]);
}
/**
 * Checks whether one unknown value exposes the Standard Schema API.
 */
export declare function isStandardSchema(value: unknown): value is WordPressStandardSchema;
/**
 * Validates one unknown value against a Standard Schema validator.
 */
export declare function validateWithStandardSchema<TOutput>(schema: WordPressStandardSchema<TOutput>, value: unknown, context?: string): Promise<TOutput>;
