import { getQueryParamsDescription } from "../catalog-helpers.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { WordPressStandardSchema } from "../core/validation.js";
import type {
  WordPressJsonSchema,
  WordPressResourceDescription,
  WordPressResourceQueryParamSchemas,
  WordPressResourceSchemaSet,
} from "../types/discovery.js";
import type {
  WordPressRequestOverrides,
  WordPressResourceToolingClient,
} from "../types/resources.js";
import { zodFromJsonSchema } from "../zod-helpers.js";

type DescribeResource = (
  options?: WordPressRequestOverrides,
) => Promise<WordPressResourceDescription>;

const standardSchemaCache = new WeakMap<
  WordPressJsonSchema,
  WordPressStandardSchema
>();

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
    getQueryParams: async (
      target: keyof WordPressResourceQueryParamSchemas = "collection",
      options?: WordPressRequestOverrides,
    ) => getQueryParamsDescription(await getDescription(options), target),
    getStandardSchema: async (
      schemaName: keyof WordPressResourceSchemaSet,
      options?: WordPressRequestOverrides,
    ): Promise<WordPressStandardSchema> =>
      getStandardSchemaFromDescription(
        await getDescription(options),
        schemaName,
      ),
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

function getStandardSchemaFromDescription(
  description: WordPressResourceDescription,
  schemaName: keyof WordPressResourceSchemaSet,
): WordPressStandardSchema {
  const jsonSchema = getJsonSchemaFromDescription(description, schemaName);
  const cached = standardSchemaCache.get(jsonSchema);
  if (cached) {
    return cached;
  }
  const standardSchema = zodFromJsonSchema(jsonSchema);
  if (!standardSchema) {
    throw createInvalidRequestError(
      `Unable to convert ${schemaName} JSON Schema to Standard Schema for ${description.kind}:${description.resource}.`,
    );
  }
  standardSchemaCache.set(
    jsonSchema,
    standardSchema as WordPressStandardSchema,
  );
  return standardSchema as WordPressStandardSchema;
}
