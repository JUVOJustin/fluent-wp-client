/**
 * Runtime helpers for converting WordPress discovery JSON Schemas to Zod validators.
 *
 * These live in the `fluent-wp-client/zod` entrypoint so the Zod dependency
 * is only pulled in when the consumer explicitly imports from that subpath.
 */
import { type ZodType, z } from "zod";
import type {
  WordPressAbilityDescription,
  WordPressJsonSchema,
  WordPressResourceDescription,
} from "./types/discovery.js";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes WordPress-specific JSON Schema quirks recursively so Zod v4's
 * strict JSON Schema importer accepts the live REST schemas WordPress emits.
 *
 * Two fixes are applied:
 *
 * - `format: "date-time"` is stripped because WordPress omits the trailing
 *   `Z` on datetime values (e.g. `2025-01-01T12:00:00`), which fails Zod's
 *   strict ISO 8601 validation while providing no real value at runtime.
 * - `type: "int"` is rewritten to `type: "integer"`, both as a scalar value
 *   and inside union arrays such as `["string", "array", "int", "null"]`.
 *   ACF's `get_rest_schema()` on choice fields emits the non-standard `int`
 *   alias, which Zod rejects outright.
 * - `type: "bool"` is rewritten to `type: "boolean"`, both as a scalar value
 *   and inside union arrays. WordPress and some plugins emit the non-standard
 *   `bool` alias, which Zod rejects outright.
 */
export function normalizeWordPressJsonSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "format" && value === "date-time") {
      continue;
    }

    if (key === "type") {
      out[key] = normalizeSchemaType(value);
      continue;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = normalizeWordPressJsonSchema(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? normalizeWordPressJsonSchema(item as Record<string, unknown>)
          : item,
      );
    } else {
      out[key] = value;
    }
  }

  return out;
}

/**
 * @deprecated Renamed to `normalizeWordPressJsonSchema` to reflect its
 * broader scope (date-time stripping plus ACF `int` type rewriting). This
 * alias is preserved for backwards compatibility and forwards directly to
 * `normalizeWordPressJsonSchema`.
 */
export const stripDateTimeFormats = normalizeWordPressJsonSchema;

/**
 * Rewrites the non-standard `int` and `bool` type aliases produced by
 * WordPress and plugin REST schemas.
 */
function normalizeSchemaType(value: unknown): unknown {
  if (value === "int") return "integer";
  if (value === "bool") return "boolean";
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry === "int") return "integer";
      if (entry === "bool") return "boolean";
      return entry;
    });
  }
  return value;
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
): ZodType | undefined {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  try {
    const normalized = stripDateTimeFormats(schema as Record<string, unknown>);
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
      input: zodFromJsonSchema(description.schemas.input),
      output: zodFromJsonSchema(description.schemas.output),
    };
  }

  return {
    collection: zodFromJsonSchema(description.schemas.collection),
    create: zodFromJsonSchema(description.schemas.create),
    item: zodFromJsonSchema(description.schemas.item),
    update: zodFromJsonSchema(description.schemas.update),
  };
}
