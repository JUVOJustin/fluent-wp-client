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
  entries: Array<[string, WordPressResourceDescription]>;
  fixedDescription: WordPressResourceDescription | undefined;
  fixedValue: string | undefined;
  selectorDescription: string;
}): ZodType {
  const {
    baseSchema,
    description,
    discriminator,
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
    return buildDiscriminatedUnion(discriminator, variants).describe(
      description,
    );
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
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: contentCollectionInputSchema,
    description: "Search and filter WordPress content",
    discriminator: "contentType",
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
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: contentGetInputSchema,
    description: "Get one WordPress content item by ID or slug",
    discriminator: "contentType",
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
      buildDiscriminatedUnion("contentType", variants),
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
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: termCollectionInputSchema,
    description: "Search and filter WordPress terms",
    discriminator: "taxonomyType",
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
}): ZodType {
  return buildCatalogReadSchema({
    baseSchema: simpleGetInputSchema,
    description: "Get one WordPress term by ID or slug",
    discriminator: "taxonomyType",
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
      buildDiscriminatedUnion("taxonomyType", variants),
      "Create or update a WordPress term",
    );
  }

  return z
    .object({
      id: termUpdateInputSchema.shape.id
        .optional()
        .describe(SAVE_ID_DESCRIPTION),
      input: termCreateInputSchema.shape.input,
      taxonomyType: z
        .string()
        .describe(
          "Taxonomy resource to write, such as categories, tags, or genre",
        ),
    })
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
      buildDiscriminatedUnion("name", variants),
      "Execute a read-only WordPress ability",
    );
  }

  return abilityGetInputSchema;
}

export function createAbilityRunInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  abilityName?: string;
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
      buildDiscriminatedUnion("name", variants),
      "Execute a WordPress ability via POST",
    );
  }

  return abilityRunInputSchema;
}

export function createAbilityDeleteInputSchema(config: {
  catalog?: WordPressDiscoveryCatalog;
  abilityName?: string;
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
      buildDiscriminatedUnion("name", variants),
      "Execute a destructive WordPress ability",
    );
  }

  return abilityDeleteInputSchema;
}
