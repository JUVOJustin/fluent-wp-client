import { z } from "zod";
import {
  getDiscoveredResourceFields,
  type WordPressResourceFieldMode,
} from "../core/discovery-fields.js";
import type { WordPressResourceDescription } from "../types/discovery.js";

/**
 * Builds catalog-aware `fields` and `_fields` input properties for AI tools.
 *
 * When discovery knows the resource's field names, the returned shape
 * constrains `fields` to a Zod enum / literal so the model cannot invent
 * unknown strings. Per-field semantics are intentionally not emitted here —
 * the AI SDK ships a dedicated `describeResourceTool` for that, and the
 * catalog-field layer stays a pure validation boundary.
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
  const names = description
    ? getDiscoveredResourceFields(description, mode).map((field) => field.name)
    : [];

  if (names.length === 0) {
    return {
      _fields: z.array(z.string()).optional().describe(aliasDescription),
      fields: z.array(z.string()).optional().describe(fallbackDescription),
    };
  }

  const [firstName, ...rest] = names;
  const selector =
    rest.length === 0
      ? z.literal(firstName as string)
      : z.enum(names as [string, ...string[]]);

  return {
    _fields: z.array(selector).optional().describe(aliasDescription),
    fields: z.array(selector).optional().describe(fallbackDescription),
  };
}
