/**
 * Normalizes WordPress-specific JSON Schema quirks recursively.
 */
export function normalizeWordPressJsonSchema(
  schema: Record<string, unknown>,
  options: {
    normalizeTypes?: boolean;
    stripDateTimeFormats?: boolean;
  } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const normalizeTypes = options.normalizeTypes ?? true;

  for (const [key, value] of Object.entries(schema)) {
    if (
      key === "format" &&
      value === "date-time" &&
      options.stripDateTimeFormats
    ) {
      continue;
    }

    if (key === "type" && normalizeTypes) {
      out[key] = normalizeSchemaType(value);
      continue;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = normalizeWordPressJsonSchema(
        value as Record<string, unknown>,
        options,
      );
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? normalizeWordPressJsonSchema(
              item as Record<string, unknown>,
              options,
            )
          : item,
      );
      continue;
    }

    out[key] = value;
  }

  return out;
}

function normalizeSchemaType(value: unknown): unknown {
  if (value === "int") return "integer";
  if (value === "bool") return "boolean";
  if (!Array.isArray(value)) return value;

  return value.map((entry) => {
    if (entry === "int") return "integer";
    if (entry === "bool") return "boolean";
    return entry;
  });
}
