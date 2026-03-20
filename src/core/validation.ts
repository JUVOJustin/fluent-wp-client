import type { StandardSchemaV1 } from '@standard-schema/spec';
import { WordPressClientError, type WordPressErrorContext } from './errors.js';

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
export class WordPressSchemaValidationError extends WordPressClientError {
  readonly issues: readonly WordPressSchemaIssue[];

  constructor(
    message: string,
    issues: readonly WordPressSchemaIssue[],
    context: WordPressErrorContext = {},
  ) {
    super({
      kind: 'SCHEMA_VALIDATION_ERROR',
      message,
      operation: context.operation,
      method: context.method,
      endpoint: context.endpoint,
    });
    this.name = 'WordPressSchemaValidationError';
    this.issues = issues;
  }
}

/**
 * Optional context fields accepted by schema validation helpers.
 */
export interface WordPressValidationContext extends WordPressErrorContext {
  message?: string;
}

/**
 * Checks whether one unknown value exposes the Standard Schema API.
 */
export function isStandardSchema(value: unknown): value is WordPressStandardSchema {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const standard = (value as Record<string, unknown>)['~standard'];

  if (typeof standard !== 'object' || standard === null) {
    return false;
  }

  return typeof (standard as { validate?: unknown }).validate === 'function';
}

/**
 * Formats one issue path to keep validation error messages readable.
 */
function formatIssuePath(issue: WordPressSchemaIssue): string {
  if (!issue.path || issue.path.length === 0) {
    return 'root';
  }

  return issue.path
    .map((segment) => {
      if (typeof segment === 'object' && segment !== null && 'key' in segment) {
        return String(segment.key);
      }

      return String(segment);
    })
    .join('.');
}

/**
 * Converts validation issues into one concise, human-readable message.
 */
function formatIssues(issues: readonly WordPressSchemaIssue[]): string {
  return issues
    .map((issue) => `${formatIssuePath(issue)}: ${issue.message}`)
    .join('; ');
}

/**
 * Validates one unknown value against a Standard Schema validator.
 */
export async function validateWithStandardSchema<TOutput>(
  schema: WordPressStandardSchema<TOutput>,
  value: unknown,
  context: string | WordPressValidationContext = 'Schema validation failed',
): Promise<TOutput> {
  const message = typeof context === 'string'
    ? context
    : context.message ?? 'Schema validation failed';

  const errorContext: WordPressErrorContext = typeof context === 'string'
    ? {}
    : {
      operation: context.operation,
      method: context.method,
      endpoint: context.endpoint,
    };

  let result = schema['~standard'].validate(value);

  if (result instanceof Promise) {
    result = await result;
  }

  if (result.issues) {
    throw new WordPressSchemaValidationError(
      `${message}: ${formatIssues(result.issues)}`,
      result.issues,
      errorContext,
    );
  }

  return result.value;
}
