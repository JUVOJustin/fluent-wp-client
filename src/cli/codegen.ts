import type { DiscoveredResource, WPSchemaProperty, WPRouteSchema } from './discover.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Sanitizes a property key for safe use as a TS/JS identifier.
 */
function sanitizeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

/**
 * Converts a resource slug to a PascalCase type name.
 */
function toPascalCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Strips read-only internal fields from a schema before code generation.
 */
function filterProperties(schema: WPRouteSchema): Record<string, WPSchemaProperty> {
  const out: Record<string, WPSchemaProperty> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (prop.readonly === true && key === '_links') continue;
    out[key] = prop;
  }
  return out;
}

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
function stripDateTimeFormats(schema: Record<string, unknown>): Record<string, unknown> {
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

/**
 * Builds a normalized JSON Schema object from a discovered resource that is
 * safe to use with both validators and `z.fromJSONSchema()`.
 */
function buildNormalizedJsonSchema(resource: DiscoveredResource): Record<string, unknown> | undefined {
  if (!resource.schema?.properties) return undefined;

  const props = filterProperties(resource.schema);
  const jsonSchema: Record<string, unknown> = {
    type: 'object',
    properties: props,
  };

  return stripDateTimeFormats(jsonSchema);
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
  slug: string;
  name: string;
  restBase: string;
  /** PascalCase name used for TypeScript type identifiers. */
  typeName: string;
  /** camelCase name used for Zod schema variable identifiers. */
  schemaName: string;
  /** camelCase name used for the exported JSON Schema variable. */
  jsonSchemaName: string;
  /** Normalized JSON Schema object ready for emission or use with `z.fromJSONSchema`. */
  jsonSchema: Record<string, unknown>;
}

/**
 * Builds the canonical resource model for all discovered resources that have
 * a usable REST schema. Normalization runs once here for all emitters.
 */
export function buildResourceSchemas(resources: DiscoveredResource[]): GeneratedResourceSchema[] {
  const result: GeneratedResourceSchema[] = [];

  for (const resource of resources) {
    const jsonSchema = buildNormalizedJsonSchema(resource);
    if (!jsonSchema) continue;

    const pascal = toPascalCase(resource.slug);

    result.push({
      slug: resource.slug,
      name: resource.name,
      restBase: resource.restBase,
      typeName: `WP${pascal}`,
      schemaName: `wp${pascal}Schema`,
      jsonSchemaName: `wp${pascal}JsonSchema`,
      jsonSchema,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// TypeScript interface emitter (legacy, kept for compatibility)
// ---------------------------------------------------------------------------

/**
 * Converts a WordPress JSON Schema property type to a TypeScript type string.
 */
function schemaTypeToTS(prop: WPSchemaProperty, indent = '  '): string {
  const types = Array.isArray(prop.type) ? prop.type : prop.type ? [prop.type] : ['unknown'];

  if (prop.enum && prop.enum.length > 0) {
    return prop.enum.map((v) => JSON.stringify(v)).join(' | ');
  }

  if (types.includes('object') && prop.properties) {
    const inner = Object.entries(prop.properties)
      .map(([key, child]) => {
        const optional = child.required ? '' : '?';
        const comment = child.description ? ` /** ${child.description} */\n${indent}  ` : '';
        return `${comment}${sanitizeKey(key)}${optional}: ${schemaTypeToTS(child, indent + '  ')};`;
      })
      .join(`\n${indent}  `);
    return `{\n${indent}  ${inner}\n${indent}}`;
  }

  if (types.includes('array') && prop.items) {
    return `${schemaTypeToTS(prop.items, indent)}[]`;
  }

  const mapped = types.map((t) => {
    switch (t) {
      case 'string': return 'string';
      case 'integer':
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'null': return 'null';
      case 'object': return 'Record<string, unknown>';
      case 'array': return 'unknown[]';
      default: return 'unknown';
    }
  });

  return mapped.length === 1 ? mapped[0] : `(${mapped.join(' | ')})`;
}

/**
 * Generates TypeScript interface declarations from discovered WordPress resources.
 *
 * Kept for backward compatibility. TS consumers using the Zod output can rely
 * on `z.infer` types instead of maintaining these separately.
 */
export function generateTypes(
  resources: DiscoveredResource[],
  siteName: string,
  siteUrl: string,
): string {
  const lines: string[] = [];

  lines.push(`// WordPress types generated by fluent-wp-client`);
  lines.push(`// Site: ${siteName} (${siteUrl})`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('');

  for (const resource of resources) {
    if (!resource.schema?.properties) continue;

    const typeName = `WP${toPascalCase(resource.slug)}`;
    const kindLabel = resource.kind === 'post_type' ? 'Post type' : 'Taxonomy';
    const props = filterProperties(resource.schema);

    lines.push(`/** ${kindLabel}: ${resource.name} (rest_base: ${resource.restBase}) */`);
    lines.push(`export interface ${typeName} {`);

    for (const [key, prop] of Object.entries(props)) {
      const optional = prop.required ? '' : '?';
      if (prop.description) {
        lines.push(`  /** ${prop.description} */`);
      }
      lines.push(`  ${sanitizeKey(key)}${optional}: ${schemaTypeToTS(prop)};`);
    }

    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
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
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    site: {
      name: siteName,
      url: siteUrl,
      generated: new Date().toISOString(),
    },
    resources: schemas,
  };

  return JSON.stringify(output, null, 2);
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
): string {
  const lines: string[] = [];

  lines.push(`// WordPress Zod schemas generated by fluent-wp-client`);
  lines.push(`// Site: ${siteName} (${siteUrl})`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`import { z } from 'zod';`);
  lines.push('');

  for (const resource of resources) {
    const kindLabel = resource.slug === resource.restBase ? 'Resource' :
      `Resource: ${resource.name} (rest_base: ${resource.restBase})`;

    lines.push(`// ${kindLabel}`);
    lines.push('');

    lines.push(`/** Normalized JSON Schema for ${resource.name}. Portable — usable outside Zod. */`);
    lines.push(`export const ${resource.jsonSchemaName} = ${JSON.stringify(resource.jsonSchema, null, 2)} as const;`);
    lines.push('');

    lines.push(`/** Zod schema for ${resource.name} — built from the JSON Schema literal above. */`);
    lines.push(`export const ${resource.schemaName} = z.fromJSONSchema(${resource.jsonSchemaName});`);
    lines.push('');

    lines.push(`/** TypeScript type for ${resource.name} — inferred from the Zod schema. */`);
    lines.push(`export type ${resource.typeName} = z.infer<typeof ${resource.schemaName}>;`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Legacy alias kept for compatibility
// ---------------------------------------------------------------------------

/**
 * Alias for `generateZodSchemas` — kept so existing callers that import
 * `generateSchemas` by name do not break before they migrate.
 *
 * @deprecated Use `generateZodSchemas` directly.
 */
export function generateSchemas(
  resources: DiscoveredResource[],
  siteName: string,
  siteUrl: string,
): string {
  return generateZodSchemas(buildResourceSchemas(resources), siteName, siteUrl);
}
