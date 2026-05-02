import type {
  WordPressDiscoveryCatalog,
  WordPressJsonSchema,
  WordPressResourceDescription,
} from "./types/discovery.js";

export type WordPressCatalogResourceKind = "content" | "term" | "resource";

export interface WordPressCatalogSelectors {
  abilityName: WordPressJsonSchema;
  contentType: WordPressJsonSchema;
  resourceType: WordPressJsonSchema;
  taxonomyType: WordPressJsonSchema;
}

export function getCatalogSelectors(
  catalog: WordPressDiscoveryCatalog,
): WordPressCatalogSelectors {
  return {
    abilityName: stringSelector(Object.keys(catalog.abilities)),
    contentType: stringSelector(Object.keys(catalog.content)),
    resourceType: stringSelector(Object.keys(catalog.resources)),
    taxonomyType: stringSelector(Object.keys(catalog.terms)),
  };
}

export function getReadableFields(
  catalog: WordPressDiscoveryCatalog,
  kind: WordPressCatalogResourceKind,
  type: string,
): string[] {
  const description = getResourceDescription(catalog, kind, type);
  return description ? getReadableFieldsDescription(description) : [];
}

export function getWritableFields(
  catalog: WordPressDiscoveryCatalog,
  kind: WordPressCatalogResourceKind,
  type: string,
  operation?: "create" | "update",
): string[] {
  const description = getResourceDescription(catalog, kind, type);
  return description
    ? getWritableFieldsDescription(description, operation)
    : [];
}

export function getQueryParams(
  catalog: WordPressDiscoveryCatalog,
  kind: WordPressCatalogResourceKind,
  type: string,
): string[] {
  const description = getResourceDescription(catalog, kind, type);
  return description ? getQueryParamsDescription(description) : [];
}

export function getReadableFieldsDescription(
  description: WordPressResourceDescription,
): string[] {
  return description.capabilities?.readFields ?? [];
}

export function getWritableFieldsDescription(
  description: WordPressResourceDescription,
  operation?: "create" | "update",
): string[] {
  const capabilities = description.capabilities;
  if (!capabilities) return [];
  if (operation === "create") return capabilities.createFields;
  if (operation === "update") return capabilities.updateFields;
  return Array.from(
    new Set([...capabilities.createFields, ...capabilities.updateFields]),
  );
}

export function getQueryParamsDescription(
  description: WordPressResourceDescription,
): string[] {
  return description.capabilities?.queryParams ?? [];
}

export function getResourceDescription(
  catalog: WordPressDiscoveryCatalog,
  kind: WordPressCatalogResourceKind,
  type: string,
): WordPressResourceDescription | undefined {
  if (kind === "content") return catalog.content[type];
  if (kind === "term") return catalog.terms[type];
  return catalog.resources[type];
}

function stringSelector(values: string[]): WordPressJsonSchema {
  return values.length > 0
    ? { enum: values, type: "string" }
    : { type: "string" };
}
