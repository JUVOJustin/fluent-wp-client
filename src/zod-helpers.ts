/**
 * Runtime helpers for converting WordPress discovery JSON Schemas to Zod validators.
 *
 * These live in the `fluent-wp-client/zod` entrypoint so the Zod dependency
 * is only pulled in when the consumer explicitly imports from that subpath.
 */
import { z, type ZodType } from 'zod';
import type {
  WordPressJsonSchema,
  WordPressResourceDescription,
  WordPressAbilityDescription,
} from './types/discovery.js';

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Strips `format: "date-time"` from all properties recursively.
 *
 * WordPress REST schemas mark date fields as `{ type: "string", format: "date-time" }`
 * but WordPress itself returns dates without a trailing `Z` (e.g. `2025-01-01T12:00:00`),
 * which fails Zod v4's strict ISO 8601 datetime validation. Stripping the format
 * makes these fields validate as plain strings while preserving every other constraint.
 */
export function stripDateTimeFormats(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'format' && value === 'date-time') {
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = stripDateTimeFormats(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? stripDateTimeFormats(item as Record<string, unknown>)
          : item,
      );
    } else {
      out[key] = value;
    }
  }

  return out;
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
export function zodFromJsonSchema(schema: WordPressJsonSchema | undefined | null): ZodType | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  try {
    const normalized = stripDateTimeFormats(schema as Record<string, unknown>);
    return z.fromJSONSchema(normalized as Parameters<typeof z.fromJSONSchema>[0]);
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
  item?: ZodType;
  collection?: ZodType;
  create?: ZodType;
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
export function zodSchemasFromDescription(description: WordPressResourceDescription): ResourceZodSchemas;
export function zodSchemasFromDescription(description: WordPressAbilityDescription): AbilityZodSchemas;
export function zodSchemasFromDescription(
  description: WordPressResourceDescription | WordPressAbilityDescription,
): ResourceZodSchemas | AbilityZodSchemas {
  if (description.kind === 'ability') {
    return {
      input: zodFromJsonSchema(description.schemas.input),
      output: zodFromJsonSchema(description.schemas.output),
    };
  }

  return {
    item: zodFromJsonSchema(description.schemas.item),
    collection: zodFromJsonSchema(description.schemas.collection),
    create: zodFromJsonSchema(description.schemas.create),
    update: zodFromJsonSchema(description.schemas.update),
  };
}
