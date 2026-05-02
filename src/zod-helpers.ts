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
    const isQuerySchema = isWordPressQuerySchema(normalized);
    const zodCompatible = isQuerySchema
      ? stripUnsupportedZodJsonSchemaKeywords(normalized)
      : normalized;
    return z
      .fromJSONSchema(zodCompatible as Parameters<typeof z.fromJSONSchema>[0])
      .superRefine((value, ctx) => {
        if (isQuerySchema) {
          validateWordPressQueryConstraints(value, ctx);
        }
      });
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isWordPressQuerySchema(schema: Record<string, unknown>): boolean {
  const properties = schema.properties;

  return (
    isRecord(properties) &&
    isRecord(properties._fields) &&
    isRecord(properties._embed)
  );
}

function stripUnsupportedZodJsonSchemaKeywords(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "if" || key === "then" || key === "else") {
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? stripUnsupportedZodJsonSchemaKeywords(
              entry as Record<string, unknown>,
            )
          : entry,
      );
      continue;
    }

    if (value && typeof value === "object") {
      out[key] = stripUnsupportedZodJsonSchemaKeywords(
        value as Record<string, unknown>,
      );
      continue;
    }

    out[key] = value;
  }

  return out;
}

function normalizeFields(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((field): field is string => typeof field === "string");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
  }

  return [];
}

function validateWordPressQueryConstraints(
  value: unknown,
  ctx: z.RefinementCtx,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  const query = value as Record<string, unknown>;
  if (query._embed !== true || query._fields === undefined) return;

  const fields = normalizeFields(query._fields);
  const hasEmbeddedSelector = fields.some(
    (field) => field === "_embedded" || /^_embedded\.[^.]+$/.test(field),
  );
  const hasLinkSelector = fields.some(
    (field) => field === "_links" || /^_links\.[^.]+$/.test(field),
  );

  if (!hasEmbeddedSelector) {
    ctx.addIssue({
      code: "custom",
      message:
        "WordPress requires _fields to include _embedded when _embed is used with _fields.",
      path: ["_fields"],
    });
  }

  if (!hasLinkSelector) {
    ctx.addIssue({
      code: "custom",
      message:
        "WordPress requires _fields to include _links when _embed is used with _fields.",
      path: ["_fields"],
    });
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
  query?: ZodType;
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
    query: zodFromJsonSchema(description.capabilities?.queryParams.collection, {
      normalizeTypes: false,
    }),
    update: zodFromJsonSchema(description.schemas.update, {
      normalizeTypes: false,
    }),
  };
}
