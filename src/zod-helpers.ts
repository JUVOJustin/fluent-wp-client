/**
 * Runtime helpers for converting WordPress discovery JSON Schemas to Zod validators.
 *
 * These live in the `fluent-wp-client/zod` entrypoint so the Zod dependency
 * is only pulled in when the consumer explicitly imports from that subpath.
 */
import { type ZodType, z } from "zod";
import { normalizeWordPressJsonSchema } from "./core/json-schema.js";
import type {
  WordPressAbilityDescription,
  WordPressJsonSchema,
  WordPressResourceDescription,
} from "./types/discovery.js";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * @deprecated Prefer `zodFromJsonSchema` for validator conversion. This
 * wrapper is preserved for backwards compatibility and keeps the original
 * date-time stripping behavior.
 */
export function stripDateTimeFormats(
  schema: Record<string, unknown>,
  options: { normalizeTypes?: boolean } = {},
): Record<string, unknown> {
  return normalizeWordPressJsonSchema(schema, {
    normalizeTypes: options.normalizeTypes,
    stripDateTimeFormats: true,
  });
}

// ---------------------------------------------------------------------------
// Core converter
// ---------------------------------------------------------------------------

/**
 * Converts a WordPress discovery JSON Schema to a Zod validator.
 *
 * Normalizes WordPress-specific quirks (e.g. `date-time` format) before
 * conversion so the resulting Zod schema validates real WordPress data
 * without false negatives.
 *
 * @example
 * ```ts
 * import { zodFromJsonSchema } from 'fluent-wp-client/zod';
 *
 * const catalog = await wp.explore();
 * const bookSchema = zodFromJsonSchema(catalog.content.books.schemas.item!);
 * const book = bookSchema.parse(rawData);
 * ```
 *
 * @returns A Zod schema, or `undefined` when the input is falsy or conversion fails.
 */
export function zodFromJsonSchema(
  schema: WordPressJsonSchema | undefined | null,
  options: { normalizeTypes?: boolean } = {},
): ZodType | undefined {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  try {
    const normalized = stripDateTimeFormats(schema as Record<string, unknown>, {
      normalizeTypes: options.normalizeTypes,
    });
    return z.fromJSONSchema(
      normalized as Parameters<typeof z.fromJSONSchema>[0],
    );
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Description-level converters
// ---------------------------------------------------------------------------

/**
 * Zod schemas for a resource description, keyed by operation.
 */
export interface ResourceZodSchemas {
  collection?: ZodType;
  create?: ZodType;
  item?: ZodType;
  update?: ZodType;
}

/**
 * Zod schemas for an ability description, keyed by direction.
 */
export interface AbilityZodSchemas {
  input?: ZodType;
  output?: ZodType;
}

/**
 * Converts all JSON Schemas from a resource description into Zod validators.
 *
 * @example
 * ```ts
 * import { zodSchemasFromDescription } from 'fluent-wp-client/zod';
 *
 * const catalog = await wp.explore();
 * const bookSchemas = zodSchemasFromDescription(catalog.content.books);
 * const validBook = bookSchemas.create?.parse({ title: 'New Book', status: 'draft' });
 * ```
 */
export function zodSchemasFromDescription(
  description: WordPressResourceDescription,
): ResourceZodSchemas;
export function zodSchemasFromDescription(
  description: WordPressAbilityDescription,
): AbilityZodSchemas;
export function zodSchemasFromDescription(
  description: WordPressResourceDescription | WordPressAbilityDescription,
): ResourceZodSchemas | AbilityZodSchemas {
  if (description.kind === "ability") {
    return {
      input: zodFromJsonSchema(description.schemas.input, {
        normalizeTypes: false,
      }),
      output: zodFromJsonSchema(description.schemas.output, {
        normalizeTypes: false,
      }),
    };
  }

  return {
    collection: zodFromJsonSchema(description.schemas.collection, {
      normalizeTypes: false,
    }),
    create: zodFromJsonSchema(description.schemas.create, {
      normalizeTypes: false,
    }),
    item: zodFromJsonSchema(description.schemas.item, {
      normalizeTypes: false,
    }),
    update: zodFromJsonSchema(description.schemas.update, {
      normalizeTypes: false,
    }),
  };
}
