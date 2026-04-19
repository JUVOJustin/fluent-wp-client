import { z } from "zod";
import {
  getDiscoveredResourceFields,
  type WordPressDiscoveredField,
  type WordPressResourceFieldMode,
} from "../core/discovery-fields.js";
import type { WordPressResourceDescription } from "../types/discovery.js";

/**
 * Builds one literal schema for a discovered field name.
 */
function createFieldLiteral(field: WordPressDiscoveredField) {
  const literal = z.literal(field.name);
  return field.description ? literal.describe(field.description) : literal;
}

/**
 * Creates one literal-union selector from discovered field descriptors.
 */
function createFieldSelector(fields: WordPressDiscoveredField[]) {
  if (fields.length === 1) {
    return createFieldLiteral(fields[0]!);
  }

  return z.union(
    fields.map((field) => createFieldLiteral(field)) as [
      ReturnType<typeof createFieldLiteral>,
      ReturnType<typeof createFieldLiteral>,
      ...Array<ReturnType<typeof createFieldLiteral>>,
    ],
  );
}

/**
 * Builds catalog-aware `fields` and `_fields` input properties for AI tools.
 *
 * Falls back to generic string arrays when no discovered field metadata is
 * available so consumers without a catalog keep the current behavior.
 */
export function createFieldSelectionShape(
  description: WordPressResourceDescription | undefined,
  mode: WordPressResourceFieldMode = "read",
): z.ZodRawShape {
  const fallbackDescription =
    "Response fields to include. Prefer the smallest useful set to keep token usage low.";
  const aliasDescription = "WordPress _fields parameter — alias for fields.";
  const fields = description
    ? getDiscoveredResourceFields(description, mode)
    : [];

  if (fields.length === 0) {
    return {
      _fields: z.array(z.string()).optional().describe(aliasDescription),
      fields: z.array(z.string()).optional().describe(fallbackDescription),
    };
  }

  const selector = createFieldSelector(fields);
  return {
    _fields: z.array(selector).optional().describe(aliasDescription),
    fields: z.array(selector).optional().describe(fallbackDescription),
  };
}
