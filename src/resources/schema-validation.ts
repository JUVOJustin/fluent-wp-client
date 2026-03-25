import type { WordPressStandardSchema } from '../core/validation.js';
import type { QueryParams } from '../types/resources.js';

/**
 * Creates reusable read validators for schema-backed resources.
 */
export function createSchemaValidators<T>(
  responseSchema: WordPressStandardSchema<T> | undefined,
  errorMessage: string,
): {
  validate: (value: unknown) => Promise<T>;
  validateCollection: (values: unknown[]) => Promise<T[]>;
} {
  const validate = async (value: unknown): Promise<T> => {
    if (!responseSchema) {
      return value as T;
    }

    const { validateWithStandardSchema } = await import('../core/validation.js');

    return validateWithStandardSchema(responseSchema, value, errorMessage);
  };

  const validateCollection = async (values: unknown[]): Promise<T[]> => {
    if (!responseSchema) {
      return values as T[];
    }

    return Promise.all(values.map((value) => validate(value)));
  };

  return {
    validate,
    validateCollection,
  };
}

/**
 * Determines whether to skip built-in schema validation for field-filtered responses.
 * Used by resource clients to avoid validation errors when fields are explicitly filtered.
 */
export function shouldSkipValidation(
  hasExplicitResponseSchema: boolean,
  filter: QueryParams | undefined,
): boolean {
  return !hasExplicitResponseSchema && filter?.fields !== undefined;
}
