/**
 * Normalizes WordPress-specific JSON Schema quirks recursively.
 */
export function normalizeWordPressJsonSchema(
  schema: Record<string, unknown>,
  options: {
    dateTimeTimezone?: string;
    normalizeTypes?: boolean;
  } = {},
  path: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const normalizeTypes = options.normalizeTypes ?? true;
  const dateTimeTimezone =
    options.dateTimeTimezone ?? stringValue(schema["x-wordpress-timezone"]);
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  );

  for (const [key, value] of Object.entries(schema)) {
    if (key === "format" && value === "date-time" && !dateTimeTimezone) {
      continue;
    }

    if (key === "properties" && isRecord(value)) {
      const parentProperty = path[path.length - 1];
      const parentAcceptsWordPressEmptyValues =
        path.length >= 2 &&
        path[path.length - 2] === "properties" &&
        (parentProperty === "acf" || parentProperty === "meta");
      const properties: Record<string, unknown> = {};

      for (const [propertyKey, propertySchema] of Object.entries(value)) {
        const normalized = isRecord(propertySchema)
          ? normalizeWordPressJsonSchema(propertySchema, options, [
              ...path,
              key,
              propertyKey,
            ])
          : propertySchema;

        properties[propertyKey] = parentAcceptsWordPressEmptyValues
          ? allowWordPressEmptyValue(normalized, {
              allowEmptyString: parentProperty === "acf",
              required: required.has(propertyKey),
            })
          : normalized;
      }

      out[key] = properties;
      continue;
    }

    if (
      key === "type" &&
      normalizeTypes &&
      (typeof value === "string" || Array.isArray(value))
    ) {
      out[key] = normalizeSchemaType(value);
      continue;
    }

    if (isRecord(value)) {
      out[key] = normalizeWordPressJsonSchema(value, options, [...path, key]);
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        isRecord(item)
          ? normalizeWordPressJsonSchema(item, options, [...path, key])
          : item,
      );
      continue;
    }

    out[key] = value;
  }

  if (schema.format === "date-time" && dateTimeTimezone) {
    out["x-wordpress-format"] = "date-time";
    out["x-wordpress-timezone"] = dateTimeTimezone;
  }

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function allowWordPressEmptyValue(
  schema: unknown,
  options: { allowEmptyString: boolean; required: boolean },
): unknown {
  if (options.required || !isRecord(schema)) return schema;

  const variants = [schema];

  if (
    schema.default !== undefined &&
    !schemaAcceptsValue(schema, schema.default)
  ) {
    variants.push(schemaFromDefaultValue(schema.default));
  }

  if (options.allowEmptyString && shouldAllowEmptyString(schema)) {
    variants.push({ const: "", type: "string" });
  }

  if (variants.length === 1) return schema;

  return copySchemaAnnotations(schema, { anyOf: variants });
}

function copySchemaAnnotations(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of ["description", "title", "default", "required"] as const) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }

  return target;
}

function shouldAllowEmptyString(schema: Record<string, unknown>): boolean {
  if (
    schema.const !== undefined ||
    Array.isArray(schema.enum) ||
    Array.isArray(schema.choices)
  ) {
    return false;
  }

  const types = schemaTypeList(schema.type);
  if (types.length === 0 || types.includes("array")) return false;
  if (types.includes("number")) return true;
  if (!types.includes("string")) return false;

  return (
    schema.format !== undefined ||
    schema.pattern !== undefined ||
    schema.minLength !== undefined
  );
}

function schemaFromDefaultValue(value: unknown): Record<string, unknown> {
  if (Array.isArray(value) && value.length === 0) {
    return { maxItems: 0, type: "array" };
  }

  if (isRecord(value) && Object.keys(value).length === 0) {
    return { maxProperties: 0, type: "object" };
  }

  return { const: value };
}

function schemaAcceptsValue(
  schema: Record<string, unknown>,
  value: unknown,
): boolean {
  if (schema.const !== undefined) return Object.is(schema.const, value);
  if (Array.isArray(schema.enum))
    return schema.enum.some((item) => Object.is(item, value));

  const types = schemaTypeList(schema.type);
  if (types.length === 0) return true;

  const valueType =
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (valueType === "number") {
    return (
      types.includes("number") ||
      (Number.isInteger(value) && types.includes("integer"))
    );
  }
  return types.includes(valueType);
}

function schemaTypeList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function normalizeSchemaType(value: unknown): unknown {
  if (value === "int") return "integer";
  if (value === "bool") return "boolean";
  if (value === "float") return "number";
  if (!Array.isArray(value)) return value;

  return value.map((entry) => {
    if (entry === "int") return "integer";
    if (entry === "bool") return "boolean";
    if (entry === "float") return "number";
    return entry;
  });
}
