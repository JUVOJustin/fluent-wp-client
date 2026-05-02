import type {
  WordPressClient,
  WordPressDiscoveryCatalog,
} from "fluent-wp-client";
import {
  getCatalogSelectors,
  getQueryParams,
  getReadableFields,
  getWritableFields,
} from "fluent-wp-client";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

describe("framework-neutral catalog helpers", () => {
  let publicClient: WordPressClient;
  let catalog: WordPressDiscoveryCatalog;

  beforeAll(async () => {
    const authClient = createAuthClient();
    publicClient = createPublicClient();
    catalog = await authClient.explore();
    publicClient.useCatalog(catalog);
  });

  it("gets catalog selectors from the cached discovery catalog", async () => {
    const selectors = getCatalogSelectors(catalog);
    const fluentSelectors = await publicClient.getCatalogSelectors();

    expect(selectors.contentType.enum).toContain("posts");
    expect(fluentSelectors.contentType.enum).toContain("books");
    expect(selectors.taxonomyType.enum).toContain("categories");
    expect(selectors.resourceType.enum).toContain("media");
  });

  it("auto-discovers selectors when the client has no cached catalog", async () => {
    const freshClient = createPublicClient();
    const selectors = await freshClient.getCatalogSelectors();

    expect(selectors.contentType.enum).toContain("posts");
  });

  it("exposes catalog helpers without requiring manual catalog walking", () => {
    expect(getReadableFields(catalog, "content", "posts")).toContain("title");
    expect(getReadableFields(catalog, "content", "posts")).toContain("acf");
    expect(getWritableFields(catalog, "content", "posts")).toContain("title");
    expect(getQueryParams(catalog, "content", "posts")).toContain("per_page");
  });

  it("exposes catalog helpers through fluent resource clients", async () => {
    await expect(
      publicClient.content("posts").getQueryParams(),
    ).resolves.toContain("per_page");
    await expect(
      publicClient.content("posts").getWritableFields(),
    ).resolves.toContain("title");

    const schema = await publicClient.content("posts").getJsonSchema("create");

    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).id).toBeUndefined();
  });
});
