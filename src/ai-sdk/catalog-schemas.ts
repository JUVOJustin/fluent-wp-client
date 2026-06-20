import { type ZodType, z } from "zod";
import { createInvalidRequestError } from "../core/errors.js";
import type {
  WordPressAbilityDescription,
  WordPressDiscoveryCatalog,
  WordPressResourceDescription,
} from "../types/discovery.js";
import { zodSchemasFromDescription } from "../zod-helpers.js";
import { createFieldSelectionShape } from "./field-schemas.js";
import {
  abilityDeleteInputSchema,
  abilityGetInputSchema,
  abilityRunInputSchema,
  contentCollectionInputSchema,
  contentCreateInputSchema,
  contentGetInputSchema,
  contentUpdateInputSchema,
  deleteInputSchema,
  simpleGetInputSchema,
  termCollectionInputSchema,
  termCreateInputSchema,
  termUpdateInputSchema,
} from "./schemas.js";

type ZodShape = z.ZodRawShape;

/**
 * Strategy for collapsing multiple catalog variants into one tool input schema.
 *
 * - `"flat"` (default): emit a single flat object whose discriminator is an
 *   `enum`/`literal` and whose remaining properties (notably `input`) are
 *   merged across variants into one permissive object. This is the
 *   LLM-friendly shape — the root is a real object with `properties`, so the
 *   model reliably fills a nested `input` object instead of serializing it to
 *   a JSON string, and it is compatible with OpenAI strict function-calling.
 *   The tradeoff is precision: because `input` sub-fields are unioned and made
 *   optional, the schema no longer enforces which fields belong to which
 *   content type. Runtime/WordPress still rejects truly invalid writes.
 * - `"union"`: emit a `z.discriminatedUnion` (the legacy shape). Stricter —
 *   each variant only accepts its own fields — but produces a top-level
 *   `oneOf` JSON Schema that LLM tool-calling handles poorly for 2+ variants.
 *
 * See issue #78 for the production failure that motivated defaulting to flat.
 */
export type DiscriminatorStrategy = "flat" | "union";

/** Default discriminator strategy applied when a caller does not override it. */
export const DEFAULT_DISCRIMINATOR_STRATEGY: DiscriminatorStrategy = "flat";

function resolveDiscriminatorStrategy(
  strategy: DiscriminatorStrategy | undefined,
): DiscriminatorStrategy {
  return strategy ?? DEFAULT_DISCRIMINATOR_STRATEGY;
}

function getObjectSchema(
  schema: ZodType | undefined,
  fallback: ZodType,
): ZodType {
  return schema ?? fallback;
}

function createSelectorSchema(
  values: string[],
  fallbackDescription: string,
): ZodType {
  if (values.length === 1) {
    return z.literal(values[0]).describe(fallbackDescription);
  }

  if (values.length > 1) {
    return z
      .enum(values as [string, ...string[]])
      .describe(fallbackDescription);
  }

  return z.string().describe(fallbackDescription);
}

function extendObjectSchema(
  schema: z.ZodObject<ZodShape>,
  shape: ZodShape,
): z.ZodObject<ZodShape> {
  return schema.extend(shape);
}

function withOptionalDescription<T extends ZodType>(
  schema: T,
  description: string,
): T {
  return schema.describe(description) as T;
}

function getContentDescriptions(
  catalog?: WordPressDiscoveryCatalog,
): Array<[string, WordPressResourceDescription]> {
  return Object.entries(catalog?.content ?? {});
}

function getTermDescriptions(
  catalog?: WordPressDiscoveryCatalog,
): Array<[string, WordPressResourceDescription]> {
  return Object.entries(catalog?.terms ?? {});
}

function getAbilityDescriptions(
  catalog?: WordPressDiscoveryCatalog,
): Array<[string, WordPressAbilityDescription]> {
  return Object.entries(catalog?.abilities ?? {});
}

function findContentDescription(
  catalog: WordPressDiscoveryCatalog | undefined,
  contentType: string | undefined,
) {
  return contentType ? catalog?.content?.[contentType] : undefined;
}

function findTermDescription(
  catalog: WordPressDiscoveryCatalog | undefined,
  taxonomyType: string | undefined,
) {
  return taxonomyType ? catalog?.terms?.[taxonomyType] : undefined;
}

function findAbilityDescription(
  catalog: WordPressDiscoveryCatalog | undefined,
  abilityName: string | undefined,
) {
  return abilityName ? catalog?.abilities?.[abilityName] : undefined;
}

function buildDiscriminatedUnion(
  discriminator: string,
  variants: z.ZodObject<ZodShape>[],
): ZodType {
  if (variants.length === 0) {
    throw createInvalidRequestError(
      `Cannot build discriminated union for '${discriminator}' without variants.`,
    );
  }

  if (variants.length === 1) {
    return variants[0];
  }

  return z.discriminatedUnion(
    discriminator,
    variants as [
      z.ZodObject<ZodShape>,
      z.ZodObject<ZodShape>,
      ...z.ZodObject<ZodShape>[],
    ],
  );
}

/** Returns true when the schema accepts `undefined` (is optional). */
function isOptionalSchema(schema: ZodType): boolean {
  return schema.safeParse(undefined).success;
}

/** Unwraps `.optional()` / `.default()` wrappers to reach the inner schema. */
function unwrapSchema(schema: ZodType): ZodType {
  let current: ZodType = schema;
  // ZodOptional/ZodDefault/ZodNullable expose their inner type via `unwrap()`.
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodNullable
  ) {
    current = (current as unknown as { unwrap: () => ZodType }).unwrap();
  }
  return current;
}

/** Extracts the literal/enum values a discriminator key carries in a variant. */
function collectDiscriminatorValues(schema: ZodType): string[] {
  const inner = unwrapSchema(schema);
  if (inner instanceof z.ZodLiteral) {
    const values = (inner as { _zod: { def: { values?: unknown[] } } })._zod.def
      .values;
    return (values ?? []).map((value) => String(value));
  }
  if (inner instanceof z.ZodEnum) {
    return Object.values(
      (inner as { _zod: { def: { entries: Record<string, string> } } })._zod.def
        .entries,
    );
  }
  return [];
}

/**
 * Collapses discriminated-union variants into a single flat object schema.
 *
 * This is the fix for issue #78: instead of a top-level `z.discriminatedUnion`
 * (which serializes to a root `oneOf` with no top-level `properties` and trips
 * up LLM tool-calling), we emit one object where:
 *
 * - the discriminator becomes an `enum` (or `z.literal` when there is a single
 *   value) so the model still picks exactly one resource;
 * - every nested object property (notably `input`) is merged across variants
 *   into ONE permissive object — the union of all variants' sub-fields, all
 *   optional, with `.catchall(z.unknown())` — so no valid field is dropped and
 *   the model sees a real object to fill rather than a union it tends to
 *   stringify;
 * - scalar properties (e.g. `id`) keep the first variant's definition;
 * - a record-typed `input` fallback (when discovery produced no object schema)
 *   stays a permissive record;
 * - `required` is the intersection of the variants' required keys plus the
 *   discriminator, so `input` stays required only when every variant required
 *   it.
 *
 * The tradeoff vs. the union strategy is precision: because `input` sub-fields
 * are merged and made optional, the static schema no longer enforces which
 * field belongs to which content type. WordPress still validates the write at
 * runtime. Use `discriminator: "union"` to opt back into the stricter shape.
 */
export function buildSelectorObject(
  discriminator: string,
  variants: z.ZodObject<ZodShape>[],
): ZodType {
  if (variants.length === 0) {
    throw createInvalidRequestError(
      `Cannot build selector object for '${discriminator}' without variants.`,
    );
  }

  if (variants.length === 1) {
    return variants[0];
  }

  const shapeOf = (variant: z.ZodObject<ZodShape>): Record<string, ZodType> =>
    variant.shape as unknown as Record<string, ZodType>;

  // Collect every discriminator literal value across variants.
  const discriminatorValues: string[] = [];
  for (const variant of variants) {
    const field = shapeOf(variant)[discriminator];
    if (!field) continue;
    for (const value of collectDiscriminatorValues(field)) {
      if (!discriminatorValues.includes(value)) discriminatorValues.push(value);
    }
  }

  const discriminatorDescription =
    shapeOf(variants[0])[discriminator]?.description ??
    `One of: ${discriminatorValues.join(", ")}`;

  const mergedShape: Record<string, ZodType> = {
    [discriminator]: createSelectorSchema(
      discriminatorValues,
      discriminatorDescription,
    ),
  };

  // Track, per non-discriminator key, whether it was required in EVERY variant
  // that declared it (intersection semantics for the final `required` list).
  const requiredInAllVariants = new Map<string, boolean>();
  // For object-typed properties, accumulate the union of their sub-shapes.
  const mergedObjectShapes = new Map<string, ZodShape>();
  const mergedObjectDescriptions = new Map<string, string | undefined>();
  // Remember keys whose property is object-typed in at least one variant.
  const objectKeys = new Set<string>();
  // Remember a fallback (non-object) schema for keys that are scalar/record.
  const scalarSchemas = new Map<string, ZodType>();

  for (const variant of variants) {
    for (const [key, field] of Object.entries(shapeOf(variant))) {
      if (key === discriminator) continue;

      const optional = isOptionalSchema(field);
      const previous = requiredInAllVariants.get(key);
      // Required only if required (not optional) in this and every prior variant.
      requiredInAllVariants.set(
        key,
        previous === undefined ? !optional : previous && !optional,
      );

      const inner = unwrapSchema(field);
      if (inner instanceof z.ZodObject) {
        objectKeys.add(key);
        const accumulated = mergedObjectShapes.get(key) ?? {};
        Object.assign(
          accumulated,
          inner.shape as unknown as Record<string, ZodType>,
        );
        mergedObjectShapes.set(key, accumulated);
        if (!mergedObjectDescriptions.has(key)) {
          mergedObjectDescriptions.set(key, field.description);
        }
      } else if (!scalarSchemas.has(key)) {
        // First scalar/record definition wins (e.g. `id`, or a record `input`
        // fallback when discovery produced no object schema).
        scalarSchemas.set(key, field);
      }
    }
  }

  const allKeys = new Set<string>([
    ...objectKeys,
    ...scalarSchemas.keys(),
    ...requiredInAllVariants.keys(),
  ]);

  for (const key of allKeys) {
    let property: ZodType;
    if (objectKeys.has(key)) {
      // Merge all variants' sub-fields into one permissive object: every
      // sub-field optional, unknown extras allowed. This keeps the nested
      // `input` a real, fillable object for the model.
      const merged = z
        .object(mergedObjectShapes.get(key) ?? {})
        .partial()
        .catchall(z.unknown());
      const description = mergedObjectDescriptions.get(key);
      property = description ? merged.describe(description) : merged;
    } else {
      property = scalarSchemas.get(key) as ZodType;
    }

    // Apply the intersection requiredness: optional unless required in all.
    const required = requiredInAllVariants.get(key) ?? false;
    mergedShape[key] =
      required || isOptionalSchema(property) ? property : property.optional();
  }

  return z.object(mergedShape);
}

/**
 * Routes variant collapsing through the configured discriminator strategy.
 *
 * `"flat"` (the default — see {@link DiscriminatorStrategy}) collapses to a
 * single object via {@link buildSelectorObject}; `"union"` preserves the legacy
 * {@link buildDiscriminatedUnion}.
 */
export function buildSelectorSchema(
  discriminator: string,
  variants: z.ZodObject<ZodShape>[],
  strategy: DiscriminatorStrategy | undefined,
): ZodType {
  return resolveDiscriminatorStrategy(strategy) === "union"
    ? buildDiscriminatedUnion(discriminator, variants)
    : buildSelectorObject(discriminator, variants);
}

/**
 * Builds a catalog-aware read input schema for content, terms, or first-class
 * resources.
 *
 * Centralizes the three branches that every read helper used to repeat:
 *
 * 1. one resource is pinned at the tool level — return the base schema plus
 *    catalog-backed field literals for that resource
 * 2. no resource is pinned but the catalog knows multiple variants — build a
 *    discriminated union so the model picks exactly one resource
 * 3. no catalog is available — fall back to the base schema with a plain
 *    selector for the missing discriminator
 */
function buildCatalogReadSchema(config: {
  baseSchema: z.ZodObject<ZodShape>;
  description: string;
  discriminator: string;
  discriminatorStrategy?: DiscriminatorStrategy;
  entries: Array<[string, WordPressResourceDescription]>;
  fixedDescription: WordPressResourceDescription | undefined;
  fixedValue: string | undefined;
  selectorDescription: string;
}): ZodType {
  const {
    baseSchema,
    description,
    discriminator,
    discriminatorStrategy,
    entries,
    fixedDescription,
    fixedValue,
    selectorDescription,
  } = config;

  if (fixedValue) {
    return baseSchema
      .extend(createFieldSelectionShape(fixedDescription, "read"))
      .describe(description);
  }

  if (entries.length > 0) {
    const variants = entries.map(([value, variantDescription]) =>
      baseSchema.extend({
        [discriminator]: z.literal(value),
        ...createFieldSelectionShape(variantDescription, "read"),
      }),
    );
    return buildSelectorSchema(
      discriminator,
      variants,
      discriminatorStrategy,
    ).describe(description);
  }

  return baseSchema
    .extend({
      [discriminator]: createSelectorSchema(
        entries.map(([value]) => value),
        selectorDescription,
      ),
    })
    .describe(description);
}

export function createContentCollectionInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  contentType?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: contentCollectionInputSchema,
    description: "Search and filter WordPress content",
    discriminator: "contentType",
    discriminatorStrategy: config.discriminator,
    entries: getContentDescriptions(config.catalog),
    fixedDescription: findContentDescription(
      config.catalog,
      config.contentType,
    ),
    fixedValue: config.contentType,
    selectorDescription:
      "Post-like resource to query, such as posts, pages, or books",
  });
}

export function createContentGetInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  contentType?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: contentGetInputSchema,
    description: "Get one WordPress content item by ID or slug",
    discriminator: "contentType",
    discriminatorStrategy: config.discriminator,
    entries: getContentDescriptions(config.catalog),
    fixedDescription: findContentDescription(
      config.catalog,
      config.contentType,
    ),
    fixedValue: config.contentType,
    selectorDescription:
      "Post-like resource to read, such as posts, pages, or books",
  });
}

const SAVE_ID_DESCRIPTION =
  "Resource ID to update. Omit to create a new item instead.";

/**
 * Builds a unified save input schema that covers both create and update for
 * one content type by making `id` optional. When the model omits `id` the
 * execution layer routes to `.create()`; when it is present it routes to
 * `.update(id, input)`. Discovery-derived create and update schemas are
 * merged with update's relaxed required constraints so a single payload
 * shape works for both modes.
 */
export function createContentSaveInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  contentType?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  const fixedDescription = findContentDescription(
    config.catalog,
    config.contentType,
  );
  if (config.contentType) {
    const schemas = fixedDescription
      ? zodSchemasFromDescription(fixedDescription)
      : undefined;
    const input = getObjectSchema(
      schemas?.update ?? schemas?.create,
      contentUpdateInputSchema.shape.input,
    );
    return z
      .object({
        id: contentUpdateInputSchema.shape.id
          .optional()
          .describe(SAVE_ID_DESCRIPTION),
        input: withOptionalDescription(
          input,
          `Fields to set on the ${config.contentType} item. When updating, omit fields you do not want to change.`,
        ),
      })
      .strict()
      .describe(`Create or update a WordPress ${config.contentType} item`);
  }

  const variants = getContentDescriptions(config.catalog).map(
    ([contentType, description]) => {
      const schemas = zodSchemasFromDescription(description);
      return z.object({
        contentType: z.literal(contentType),
        id: contentUpdateInputSchema.shape.id
          .optional()
          .describe(SAVE_ID_DESCRIPTION),
        input: withOptionalDescription(
          getObjectSchema(
            schemas.update ?? schemas.create,
            contentUpdateInputSchema.shape.input,
          ),
          `Fields to set on the ${contentType} item. When updating, omit fields you do not want to change.`,
        ),
      });
    },
  );

  if (variants.length > 0) {
    return withOptionalDescription(
      buildSelectorSchema("contentType", variants, config.discriminator),
      "Create or update a WordPress content item",
    );
  }

  return z
    .object({
      contentType: z
        .string()
        .describe(
          "Post-like resource to write, such as posts, pages, or books",
        ),
      id: contentUpdateInputSchema.shape.id
        .optional()
        .describe(SAVE_ID_DESCRIPTION),
      input: contentCreateInputSchema.shape.input,
    })
    .describe("Create or update a WordPress content item");
}

export function createContentDeleteInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  contentType?: string;
}): ZodType {
  if (config.contentType) {
    return deleteInputSchema;
  }

  const values = getContentDescriptions(config.catalog).map(
    ([contentType]) => contentType,
  );
  return extendObjectSchema(deleteInputSchema, {
    contentType: createSelectorSchema(
      values,
      "Post-like resource to delete from, such as posts, pages, or books",
    ),
  }).describe("Delete a WordPress content item");
}

export function createTermCollectionInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  taxonomyType?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: termCollectionInputSchema,
    description: "Search and filter WordPress terms",
    discriminator: "taxonomyType",
    discriminatorStrategy: config.discriminator,
    entries: getTermDescriptions(config.catalog),
    fixedDescription: findTermDescription(config.catalog, config.taxonomyType),
    fixedValue: config.taxonomyType,
    selectorDescription:
      "Taxonomy resource to query, such as categories, tags, or genre",
  });
}

export function createTermGetInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  taxonomyType?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: simpleGetInputSchema,
    description: "Get one WordPress term by ID or slug",
    discriminator: "taxonomyType",
    discriminatorStrategy: config.discriminator,
    entries: getTermDescriptions(config.catalog),
    fixedDescription: findTermDescription(config.catalog, config.taxonomyType),
    fixedValue: config.taxonomyType,
    selectorDescription:
      "Taxonomy resource to read, such as categories, tags, or genre",
  });
}

export function createTermSaveInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  taxonomyType?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  const fixedDescription = findTermDescription(
    config.catalog,
    config.taxonomyType,
  );
  if (config.taxonomyType) {
    const schemas = fixedDescription
      ? zodSchemasFromDescription(fixedDescription)
      : undefined;
    const input = getObjectSchema(
      schemas?.update ?? schemas?.create,
      termUpdateInputSchema.shape.input,
    );
    return z
      .object({
        id: termUpdateInputSchema.shape.id
          .optional()
          .describe(SAVE_ID_DESCRIPTION),
        input: withOptionalDescription(
          input,
          `Fields to set on the ${config.taxonomyType} term. When updating, omit fields you do not want to change.`,
        ),
      })
      .describe(`Create or update a WordPress ${config.taxonomyType} term`);
  }

  const variants = getTermDescriptions(config.catalog).map(
    ([taxonomyType, description]) => {
      const schemas = zodSchemasFromDescription(description);
      return z.object({
        id: termUpdateInputSchema.shape.id
          .optional()
          .describe(SAVE_ID_DESCRIPTION),
        input: withOptionalDescription(
          getObjectSchema(
            schemas.update ?? schemas.create,
            termUpdateInputSchema.shape.input,
          ),
          `Fields to set on the ${taxonomyType} term. When updating, omit fields you do not want to change.`,
        ),
        taxonomyType: z.literal(taxonomyType),
      });
    },
  );

  if (variants.length > 0) {
    return withOptionalDescription(
      buildSelectorSchema("taxonomyType", variants, config.discriminator),
      "Create or update a WordPress term",
    );
  }

  return z
    .union([
      z.object({
        input: termCreateInputSchema.shape.input,
        taxonomyType: z
          .string()
          .describe(
            "Taxonomy resource to write, such as categories, tags, or genre",
          ),
      }),
      z.object({
        id: termUpdateInputSchema.shape.id.describe(SAVE_ID_DESCRIPTION),
        input: termUpdateInputSchema.shape.input,
        taxonomyType: z
          .string()
          .describe(
            "Taxonomy resource to write, such as categories, tags, or genre",
          ),
      }),
    ])
    .describe("Create or update a WordPress term");
}

export function createTermDeleteInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  taxonomyType?: string;
}): ZodType {
  if (config.taxonomyType) {
    return deleteInputSchema;
  }

  const values = getTermDescriptions(config.catalog).map(
    ([taxonomyType]) => taxonomyType,
  );
  return extendObjectSchema(deleteInputSchema, {
    taxonomyType: createSelectorSchema(
      values,
      "Taxonomy resource to delete from, such as categories, tags, or genre",
    ),
  }).describe("Delete a WordPress term");
}

export function createAbilityGetInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  abilityName?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  const fixedDescription = findAbilityDescription(
    config.catalog,
    config.abilityName,
  );
  if (config.abilityName) {
    const schemas = fixedDescription
      ? zodSchemasFromDescription(fixedDescription)
      : undefined;
    return z
      .object({
        input: withOptionalDescription(
          getObjectSchema(schemas?.input, abilityGetInputSchema.shape.input),
          "Optional primitive input value for GET execution",
        ).optional(),
      })
      .describe(`Execute the ${config.abilityName} WordPress ability via GET`);
  }

  const variants = getAbilityDescriptions(config.catalog).map(
    ([abilityName, description]) => {
      const schemas = zodSchemasFromDescription(description);
      return z.object({
        input: withOptionalDescription(
          getObjectSchema(schemas.input, abilityGetInputSchema.shape.input),
          "Optional primitive input value for GET execution",
        ).optional(),
        name: z.literal(abilityName),
      });
    },
  );

  if (variants.length > 0) {
    return withOptionalDescription(
      buildSelectorSchema("name", variants, config.discriminator),
      "Execute a read-only WordPress ability",
    );
  }

  return abilityGetInputSchema;
}

export function createAbilityRunInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  abilityName?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  const fixedDescription = findAbilityDescription(
    config.catalog,
    config.abilityName,
  );
  if (config.abilityName) {
    const schemas = fixedDescription
      ? zodSchemasFromDescription(fixedDescription)
      : undefined;
    return z
      .object({
        input: withOptionalDescription(
          getObjectSchema(schemas?.input, abilityRunInputSchema.shape.input),
          "Optional input value for POST execution",
        ).optional(),
      })
      .describe(`Execute the ${config.abilityName} WordPress ability via POST`);
  }

  const variants = getAbilityDescriptions(config.catalog).map(
    ([abilityName, description]) => {
      const schemas = zodSchemasFromDescription(description);
      return z.object({
        input: withOptionalDescription(
          getObjectSchema(schemas.input, abilityRunInputSchema.shape.input),
          "Optional input value for POST execution",
        ).optional(),
        name: z.literal(abilityName),
      });
    },
  );

  if (variants.length > 0) {
    return withOptionalDescription(
      buildSelectorSchema("name", variants, config.discriminator),
      "Execute a WordPress ability via POST",
    );
  }

  return abilityRunInputSchema;
}

export function createAbilityDeleteInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  abilityName?: string;
  discriminator?: DiscriminatorStrategy;
}): ZodType {
  const fixedDescription = findAbilityDescription(
    config.catalog,
    config.abilityName,
  );
  if (config.abilityName) {
    const schemas = fixedDescription
      ? zodSchemasFromDescription(fixedDescription)
      : undefined;
    return z
      .object({
        input: withOptionalDescription(
          getObjectSchema(schemas?.input, abilityDeleteInputSchema.shape.input),
          "Optional primitive input value for DELETE execution",
        ).optional(),
      })
      .describe(
        `Execute the ${config.abilityName} WordPress ability via DELETE`,
      );
  }

  const variants = getAbilityDescriptions(config.catalog).map(
    ([abilityName, description]) => {
      const schemas = zodSchemasFromDescription(description);
      return z.object({
        input: withOptionalDescription(
          getObjectSchema(schemas.input, abilityDeleteInputSchema.shape.input),
          "Optional primitive input value for DELETE execution",
        ).optional(),
        name: z.literal(abilityName),
      });
    },
  );

  if (variants.length > 0) {
    return withOptionalDescription(
      buildSelectorSchema("name", variants, config.discriminator),
      "Execute a destructive WordPress ability",
    );
  }

  return abilityDeleteInputSchema;
}
