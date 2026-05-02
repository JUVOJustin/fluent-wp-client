import { normalizeWordPressJsonSchema } from "../core/json-schema.js";
import type {
  DiscoveredResource,
  WPRouteSchema,
  WPSchemaProperty,
} from "./discover.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Converts a resource slug to a PascalCase type name.
 */
function toPascalCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

/**
 * Strips read-only internal fields from a schema before code generation.
 */
function filterProperties(
  schema: WPRouteSchema,
): Record<string, WPSchemaProperty> {
  const out: Record<string, WPSchemaProperty> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (prop.readonly === true && key === "_links") continue;
    out[key] = prop;
  }
  return out;
}

/**
 * Builds a normalized JSON Schema object from a discovered resource that is
 * safe to use with both validators and `z.fromJSONSchema()`.
 */
function buildNormalizedJsonSchema(
  resource: DiscoveredResource,
): Record<string, unknown> | undefined {
  if (!resource.schema?.properties) return undefined;

  const props = filterProperties(resource.schema);
  const jsonSchema: Record<string, unknown> = {
    properties: props,
    type: "object",
  };

  return normalizeWordPressJsonSchema(jsonSchema);
}

// ---------------------------------------------------------------------------
// Canonical resource model
// ---------------------------------------------------------------------------

/**
 * Enriched schema model for a single resource, used by all emitters.
 *
 * Building this once and passing it through every emitter avoids re-running
 * normalization and name derivation separately per format.
 */
export interface GeneratedResourceSchema {
  /** Normalized JSON Schema object ready for emission or use with `z.fromJSONSchema`. */
  jsonSchema: Record<string, unknown>;
  /** camelCase name used for the exported JSON Schema variable. */
  jsonSchemaName: string;
  name: string;
  restBase: string;
  /** camelCase name used for Zod schema variable identifiers. */
  schemaName: string;
  slug: string;
  /** PascalCase name used for TypeScript type identifiers. */
  typeName: string;
}

/**
 * Builds the canonical resource model for all discovered resources that have
 * a usable REST schema. Normalization runs once here for all emitters.
 */
export function buildResourceSchemas(
  resources: DiscoveredResource[],
): GeneratedResourceSchema[] {
  const result: GeneratedResourceSchema[] = [];

  for (const resource of resources) {
    const jsonSchema = buildNormalizedJsonSchema(resource);
    if (!jsonSchema) continue;

    const pascal = toPascalCase(resource.slug);

    result.push({
      jsonSchema,
      jsonSchemaName: `wp${pascal}JsonSchema`,
      name: resource.name,
      restBase: resource.restBase,
      schemaName: `wp${pascal}Schema`,
      slug: resource.slug,
      typeName: `WP${pascal}`,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// JSON Schema emitter
// ---------------------------------------------------------------------------

/**
 * Emits a single JSON file containing all discovered resource schemas keyed
 * by REST base. Normalized for practical validation — not a raw WP discovery dump.
 *
 * The `$schema` annotation targets JSON Schema Draft 2020-12, which is the
 * default target for `z.toJSONSchema()` in Zod v4 and Ajv v8+.
 */
export function generateJsonSchemas(
  resources: GeneratedResourceSchema[],
  siteName: string,
  siteUrl: string,
): string {
  const schemas: Record<string, unknown> = {};

  for (const resource of resources) {
    schemas[resource.restBase] = resource.jsonSchema;
  }

  const output = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    resources: schemas,
    site: {
      generated: new Date().toISOString(),
      name: siteName,
      url: siteUrl,
    },
  };

  return JSON.stringify(output, null, 2);
}

// ---------------------------------------------------------------------------
// TypeScript declaration emitter
// ---------------------------------------------------------------------------

type JsonSchemaObject = Record<string, unknown>;

/**
 * Narrows unknown JSON Schema nodes before reading nested fields.
 */
function isObject(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Converts a JSON object key into a valid TypeScript property name.
 */
function tsPropertyName(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * Converts schema descriptions into safe JSDoc text.
 */
function sanitizeComment(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.replace(/\*\//g, "*\\/").replace(/\s+/g, " ").trim();
}

/**
 * Converts JSON Schema `type` values into a normalized string list.
 */
function schemaTypeList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

/**
 * Emits TypeScript string literal unions for JSON Schema enum values.
 */
function enumToType(values: unknown[]): string {
  const literals = values.map((value) => {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value === null) return "null";
    return "unknown";
  });

  return Array.from(new Set(literals)).join(" | ") || "unknown";
}

/**
 * Emits an inline TypeScript object type from JSON Schema object properties.
 */
function objectSchemaToType(schema: JsonSchemaObject, indent: string): string {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? new Set(
        schema.required.filter(
          (item): item is string => typeof item === "string",
        ),
      )
    : new Set<string>();
  const entries = Object.entries(properties);
  const additionalProperties = schema.additionalProperties;
  const nextIndent = `${indent}  `;

  if (entries.length === 0) {
    if (isObject(additionalProperties)) {
      return `Record<string, ${schemaToType(additionalProperties, indent)}>`;
    }
    return "Record<string, unknown>";
  }

  const lines = ["{"];

  for (const [key, value] of entries) {
    const propSchema = isObject(value) ? value : {};
    const description = sanitizeComment(propSchema.description);
    const optional = !required.has(key) && propSchema.required !== true;

    if (description) {
      lines.push(`${nextIndent}/** ${description} */`);
    }

    lines.push(
      `${nextIndent}${tsPropertyName(key)}${optional ? "?" : ""}: ${schemaToType(propSchema, nextIndent)};`,
    );
  }

  if (additionalProperties === true) {
    lines.push(`${nextIndent}[key: string]: unknown;`);
  } else if (isObject(additionalProperties)) {
    lines.push(
      `${nextIndent}[key: string]: ${schemaToType(additionalProperties, nextIndent)};`,
    );
  }

  lines.push(`${indent}}`);
  return lines.join("\n");
}

/**
 * Converts one normalized JSON Schema node into a TypeScript type expression.
 */
function schemaToType(schema: JsonSchemaObject, indent = ""): string {
  if (Array.isArray(schema.enum)) {
    return enumToType(schema.enum);
  }

  const unionSchemas = Array.isArray(schema.oneOf)
    ? schema.oneOf
    : Array.isArray(schema.anyOf)
      ? schema.anyOf
      : undefined;

  if (unionSchemas) {
    const types = unionSchemas.map((item) =>
      isObject(item) ? schemaToType(item, indent) : "unknown",
    );
    return Array.from(new Set(types)).join(" | ") || "unknown";
  }

  const allTypes = schemaTypeList(schema.type);
  const hasNull = allTypes.includes("null");
  const types = allTypes.filter((type) => type !== "null");

  if (types.length > 1) {
    const union = types
      .map((type) => schemaToType({ ...schema, type }, indent))
      .join(" | ");
    return hasNull ? `${union} | null` : union;
  }

  const type = types[0];
  let output: string;

  if (type === "array") {
    output = isObject(schema.items)
      ? `Array<${schemaToType(schema.items, indent)}>`
      : "unknown[]";
  } else if (type === "boolean") {
    output = "boolean";
  } else if (type === "integer" || type === "number") {
    output = "number";
  } else if (type === "object" || isObject(schema.properties)) {
    output = objectSchemaToType(schema, indent);
  } else if (type === "string") {
    output = "string";
  } else {
    output = "unknown";
  }

  return hasNull ? `${output} | null` : output;
}

/**
 * Generates a dependency-free TypeScript module with real type declarations
 * derived from the same normalized JSON Schemas used by the runtime emitters.
 */
export function generateTypeDefinitions(
  resources: GeneratedResourceSchema[],
  siteName: string,
  siteUrl: string,
): string {
  const lines: string[] = [];

  lines.push("// WordPress TypeScript types generated by fluent-wp-client");
  lines.push(`// Site: ${siteName} (${siteUrl})`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const resource of resources) {
    const description = sanitizeComment(resource.name);
    const type = schemaToType(resource.jsonSchema);

    if (description) {
      lines.push(`/** TypeScript type for ${description}. */`);
    }

    if (type.startsWith("{\n")) {
      lines.push(`export interface ${resource.typeName} ${type}`);
    } else {
      lines.push(`export type ${resource.typeName} = ${type};`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Zod schema emitter
// ---------------------------------------------------------------------------

/**
 * Generates a TypeScript module containing Zod schemas and inferred types for
 * all discovered WordPress resources.
 *
 * Each resource gets three exports:
 * - A JSON Schema literal (`wp${Resource}JsonSchema`) — portable and usable
 *   outside Zod.
 * - A Zod schema (`wp${Resource}Schema`) built from the JSON Schema literal via
 *   `z.fromJSONSchema`, keeping the two in sync automatically.
 * - A TypeScript type (`WP${Resource}`) inferred from the Zod schema, so the
 *   runtime validator and the static type always agree.
 */
export function generateZodSchemas(
  resources: GeneratedResourceSchema[],
  siteName: string,
  siteUrl: string,
  options: { typescript?: boolean } = {},
): string {
  const lines: string[] = [];
  const typescript = options.typescript ?? true;

  lines.push(`// WordPress Zod schemas generated by fluent-wp-client`);
  lines.push(`// Site: ${siteName} (${siteUrl})`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`import { z } from 'zod';`);
  lines.push("");

  for (const resource of resources) {
    const kindLabel =
      resource.slug === resource.restBase
        ? "Resource"
        : `Resource: ${resource.name} (rest_base: ${resource.restBase})`;

    lines.push(`// ${kindLabel}`);
    lines.push("");

    lines.push(
      `/** Normalized JSON Schema for ${resource.name}. Portable — usable outside Zod. */`,
    );
    lines.push(
      `export const ${resource.jsonSchemaName} = ${JSON.stringify(resource.jsonSchema, null, 2)}${typescript ? " as const" : ""};`,
    );
    lines.push("");

    lines.push(
      `/** Zod schema for ${resource.name} — built from the JSON Schema literal above. */`,
    );
    lines.push(
      `export const ${resource.schemaName} = z.fromJSONSchema(${resource.jsonSchemaName});`,
    );
    lines.push("");

    if (typescript) {
      lines.push(
        `/** TypeScript type for ${resource.name} — inferred from the Zod schema. */`,
      );
      lines.push(
        `export type ${resource.typeName} = z.infer<typeof ${resource.schemaName}>;`,
      );
      lines.push("");
    }
  }

  return lines.join("\n");
}
