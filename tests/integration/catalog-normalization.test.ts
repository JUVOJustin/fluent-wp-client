import type { WordPressDiscoveryCatalog } from "fluent-wp-client";
import { describe, expect, it } from "vitest";
import { createAuthClient } from "../helpers/wp-client";

function findFloatSchemaTypePaths(value: unknown, path = "catalog"): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findFloatSchemaTypePaths(item, `${path}[${index}]`),
    );
  }

  const record = value as Record<string, unknown>;
  const current = record.type === "float" ? [path] : [];

  return current.concat(
    Object.entries(record).flatMap(([key, item]) =>
      findFloatSchemaTypePaths(item, `${path}.${key}`),
    ),
  );
}

function getCatalogSchemas(catalog: WordPressDiscoveryCatalog) {
  return {
    abilities: Object.fromEntries(
      Object.entries(catalog.abilities).map(([key, description]) => [
        key,
        description.schemas,
      ]),
    ),
    content: Object.fromEntries(
      Object.entries(catalog.content).map(([key, description]) => [
        key,
        description.schemas,
      ]),
    ),
    resources: Object.fromEntries(
      Object.entries(catalog.resources).map(([key, description]) => [
        key,
        description.schemas,
      ]),
    ),
    terms: Object.fromEntries(
      Object.entries(catalog.terms).map(([key, description]) => [
        key,
        description.schemas,
      ]),
    ),
  };
}

describe("Discovery catalog normalization", () => {
  it("normalizes float aliases out of catalog schemas", async () => {
    const catalog = await createAuthClient().explore({ refresh: true });
    const schemas = getCatalogSchemas(catalog);

    expect(
      catalog.abilities["test/process-complex"]?.schemas.input?.properties
        ?.settings?.properties?.priority_score,
    ).toMatchObject({ type: "number" });
    expect(findFloatSchemaTypePaths(schemas)).toEqual([]);
  });
});
