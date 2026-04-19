import type {
  WordPressJsonSchema,
  WordPressResourceDescription,
} from "../types/discovery.js";

/**
 * Normalized field descriptor derived from a discovered resource schema.
 *
 * This powers catalog-aware field selection without exposing raw JSON Schema
 * traversal to higher-level integrations such as the AI SDK.
 */
export interface WordPressDiscoveredField {
  description?: string;
  name: string;
}

/**
 * One schema mode that can expose field names.
 */
export type WordPressResourceFieldMode = "read" | "create" | "update";

interface SchemaPropertyNode {
  description?: unknown;
  properties?: Record<string, SchemaPropertyNode>;
}

function normalizeDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Picks the discovered schema that corresponds to one resource mode.
 */
function schemaForMode(
  description: WordPressResourceDescription,
  mode: WordPressResourceFieldMode,
): WordPressJsonSchema | undefined {
  if (mode === "read") return description.schemas.item;
  if (mode === "create") return description.schemas.create;
  return description.schemas.update;
}

function fallbackFieldNames(
  description: WordPressResourceDescription,
  mode: WordPressResourceFieldMode,
): string[] {
  if (mode === "read") return description.capabilities?.readFields ?? [];
  if (mode === "create") return description.capabilities?.createFields ?? [];
  return description.capabilities?.updateFields ?? [];
}

/**
 * Flattens nested JSON Schema object properties into dot-separated field paths.
 */
function collectSchemaFields(
  properties: Record<string, SchemaPropertyNode>,
  prefix?: string,
): WordPressDiscoveredField[] {
  const fields: WordPressDiscoveredField[] = [];

  for (const [name, property] of Object.entries(properties)) {
    const fieldName = prefix ? `${prefix}.${name}` : name;
    const description = normalizeDescription(property.description);
    fields.push({ description, name: fieldName });

    if (property.properties && typeof property.properties === "object") {
      fields.push(...collectSchemaFields(property.properties, fieldName));
    }
  }

  return fields;
}

/**
 * Returns catalog-derived field descriptors for one resource mode.
 *
 * The result includes top-level fields plus nested object fields such as
 * `title.rendered`, `acf.acf_subtitle`, and `meta.test_string_meta` when the
 * discovery schema exposes them.
 */
export function getDiscoveredResourceFields(
  description: WordPressResourceDescription,
  mode: WordPressResourceFieldMode,
): WordPressDiscoveredField[] {
  const schema = schemaForMode(description, mode);
  const properties = schema?.properties;

  if (!properties || typeof properties !== "object") {
    return fallbackFieldNames(description, mode).map((name) => ({ name }));
  }

  const discovered = collectSchemaFields(
    properties as Record<string, SchemaPropertyNode>,
  );
  const deduped = new Map<string, WordPressDiscoveredField>();

  for (const field of discovered) {
    if (!deduped.has(field.name)) {
      deduped.set(field.name, field);
      continue;
    }

    const existing = deduped.get(field.name)!;
    if (!existing.description && field.description) {
      deduped.set(field.name, field);
    }
  }

  for (const name of fallbackFieldNames(description, mode)) {
    if (!deduped.has(name)) {
      deduped.set(name, { name });
    }
  }

  return Array.from(deduped.values());
}
