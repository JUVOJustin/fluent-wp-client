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
export class WordPressSchemaValidationError extends Error {
  readonly issues: readonly WordPressSchemaIssue[];

  constructor(message: string, issues: readonly WordPressSchemaIssue[]) {
    super(message);
    this.name = 'WordPressSchemaValidationError';
    this.issues = issues;
  }
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
  context = 'Schema validation failed',
): Promise<TOutput> {
  let result = schema['~standard'].validate(value);

  if (result instanceof Promise) {
    result = await result;
  }

  if (result.issues) {
    throw new WordPressSchemaValidationError(
      `${context}: ${formatIssues(result.issues)}`,
      result.issues,
    );
  }

  return result.value;
}
