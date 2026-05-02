import type {
  WordPressDiscoveryCatalog,
  WordPressJsonSchema,
  WordPressResourceDescription,
  WordPressResourceQueryParamSchemas,
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

export function getQueryParams(
  catalog: WordPressDiscoveryCatalog,
  kind: WordPressCatalogResourceKind,
  type: string,
  target: keyof WordPressResourceQueryParamSchemas = "collection",
): WordPressJsonSchema {
  const description = getResourceDescription(catalog, kind, type);
  return description
    ? getQueryParamsDescription(description, target)
    : emptyObjectSchema();
}

export function getQueryParamsDescription(
  description: WordPressResourceDescription,
  target: keyof WordPressResourceQueryParamSchemas = "collection",
): WordPressJsonSchema {
  return description.capabilities?.queryParams[target] ?? emptyObjectSchema();
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

function emptyObjectSchema(): WordPressJsonSchema {
  return { properties: {}, type: "object" };
}
