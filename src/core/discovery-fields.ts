import type {
  WordPressJsonSchema,
  WordPressResourceDescription,
} from "../types/discovery.js";

/**
 * One schema mode that can expose field names.
 */
export type WordPressResourceFieldMode = "read" | "create" | "update";

interface SchemaPropertyNode {
  properties?: Record<string, SchemaPropertyNode>;
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

/**
 * Flattens nested JSON Schema object properties into dot-separated field paths.
 */
function collectSchemaFieldNames(
  properties: Record<string, SchemaPropertyNode>,
  prefix?: string,
): string[] {
  const names: string[] = [];

  for (const [name, property] of Object.entries(properties)) {
    const fieldName = prefix ? `${prefix}.${name}` : name;
    names.push(fieldName);

    if (property.properties && typeof property.properties === "object") {
      names.push(...collectSchemaFieldNames(property.properties, fieldName));
    }
  }

  return names;
}

/**
 * A single discovered field, represented as a normalized descriptor so that
 * callers can evolve the shape without breaking the API surface. The name
 * path is the only field consumed today.
 */
export interface WordPressDiscoveredField {
  name: string;
}

/**
 * Returns catalog-derived field descriptors for one resource mode.
 *
 * The result includes top-level fields plus nested object fields such as
 * `title.rendered`, `acf.acf_subtitle`, and `meta.test_string_meta` when the
 * discovery schema exposes them. Duplicates are collapsed so a nested field
 * path always appears once.
 */
export function getDiscoveredResourceFields(
  description: WordPressResourceDescription,
  mode: WordPressResourceFieldMode,
): WordPressDiscoveredField[] {
  const schema = schemaForMode(description, mode);
  const properties = schema?.properties;

  const names = new Set<string>();

  if (properties && typeof properties === "object") {
    for (const name of collectSchemaFieldNames(
      properties as Record<string, SchemaPropertyNode>,
    )) {
      names.add(name);
    }
  }

  return Array.from(names, (name) => ({ name }));
}
