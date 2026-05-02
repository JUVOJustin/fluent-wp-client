import {
  getQueryParamsDescription,
  getReadableFieldsDescription,
  getWritableFieldsDescription,
} from "../catalog-helpers.js";
import { createInvalidRequestError } from "../core/errors.js";
import type {
  WordPressJsonSchema,
  WordPressResourceDescription,
  WordPressResourceSchemaSet,
} from "../types/discovery.js";
import type {
  WordPressRequestOverrides,
  WordPressResourceToolingClient,
} from "../types/resources.js";

type DescribeResource = (
  options?: WordPressRequestOverrides,
) => Promise<WordPressResourceDescription>;

/**
 * Adds discovery-backed schema helpers to fluent resource clients.
 */
export function createSchemaToolMethods(
  describe: DescribeResource,
): WordPressResourceToolingClient {
  const getDescription = (options?: WordPressRequestOverrides) =>
    describe(options);

  return {
    getJsonSchema: async (
      schemaName: keyof WordPressResourceSchemaSet,
      options?: WordPressRequestOverrides,
    ): Promise<WordPressJsonSchema> =>
      getJsonSchemaFromDescription(await getDescription(options), schemaName),
    getQueryParams: async (options) =>
      getQueryParamsDescription(await getDescription(options)),
    getReadableFields: async (options) =>
      getReadableFieldsDescription(await getDescription(options)),
    getWritableFields: async (operation, options) =>
      getWritableFieldsDescription(await getDescription(options), operation),
  };
}

function getJsonSchemaFromDescription(
  description: WordPressResourceDescription,
  schemaName: keyof WordPressResourceSchemaSet,
): WordPressJsonSchema {
  const schema = description.schemas[schemaName];
  if (!schema) {
    throw createInvalidRequestError(
      `No ${schemaName} JSON Schema is available for ${description.kind}:${description.resource}.`,
    );
  }
  return schema;
}
