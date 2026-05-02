import type {
  WordPressClient,
  WordPressDiscoveryCatalog,
} from "fluent-wp-client";
import { getCatalogSelectors, getQueryParams } from "fluent-wp-client";
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
    const queryParams = getQueryParams(catalog, "content", "posts");

    expect(queryParams).toMatchObject({
      properties: {
        _embed: { type: "boolean" },
        _fields: { items: expect.any(Object), type: "array" },
        per_page: { type: "integer" },
        search: { type: "string" },
      },
      type: "object",
    });
    expect(
      (queryParams as Record<string, unknown>)["x-wordpress-query-constraints"],
    ).toBeUndefined();
  });

  it("exposes catalog helpers through fluent resource clients", async () => {
    await expect(
      publicClient.content("posts").getQueryParams(),
    ).resolves.toMatchObject({
      properties: {
        _embed: { type: "boolean" },
        _fields: { items: expect.any(Object), type: "array" },
        per_page: { type: "integer" },
        search: { type: "string" },
      },
      type: "object",
    });

    const schema = await publicClient.content("posts").getJsonSchema("create");

    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).id).toBe(false);
  });

  it("exposes item query params separately from collection params", async () => {
    const itemSchema = await publicClient
      .content("posts")
      .getQueryParams("item");
    const collectionSchema = await publicClient
      .content("posts")
      .getQueryParams("collection");
    const itemProperties = itemSchema.properties as Record<string, unknown>;
    const collectionProperties = collectionSchema.properties as Record<
      string,
      unknown
    >;

    expect(itemProperties.context).toBeDefined();
    expect(itemProperties.excerpt_length).toBeDefined();
    expect(itemProperties.password).toBeDefined();
    expect(itemProperties._fields).toBeDefined();
    expect(itemProperties._embed).toBeDefined();
    expect(itemProperties.page).toBeUndefined();
    expect(itemProperties.per_page).toBeUndefined();
    expect(itemProperties.search).toBeUndefined();
    expect(itemProperties.status).toBeUndefined();
    expect(collectionProperties.page).toMatchObject({ type: "integer" });
    expect(collectionProperties.per_page).toMatchObject({ type: "integer" });
    expect(collectionProperties.search).toMatchObject({ type: "string" });
  });

  it("documents only WordPress-supported link and embed field selector depth", async () => {
    const schema = await publicClient.content("posts").getQueryParams("item");
    const fieldsSchema = (schema.properties as Record<string, unknown>)
      ._fields as {
      items: { anyOf?: Array<Record<string, unknown>> };
    };
    const selectorSchemas = fieldsSchema.items.anyOf ?? [];

    expect(selectorSchemas).toContainEqual(
      expect.objectContaining({ pattern: "^_links\\.[^.]+$" }),
    );
    expect(selectorSchemas).toContainEqual(
      expect.objectContaining({ pattern: "^_embedded\\.[^.]+$" }),
    );
    const linkPattern = selectorSchemas.find(
      (entry) => entry.pattern === "^_links\\.[^.]+$",
    );
    const embeddedPattern = selectorSchemas.find(
      (entry) => entry.pattern === "^_embedded\\.[^.]+$",
    );

    expect("_links.author").toMatch(new RegExp(linkPattern?.pattern as string));
    expect("_links.author.href").not.toMatch(
      new RegExp(linkPattern?.pattern as string),
    );
    expect("_embedded.author").toMatch(
      new RegExp(embeddedPattern?.pattern as string),
    );
    expect("_embedded.author.name").not.toMatch(
      new RegExp(embeddedPattern?.pattern as string),
    );
  });

  it("supports first-level link and embedded field filtering in WordPress", async () => {
    const posts = (await publicClient.content("posts").list({
      _embed: true,
      _fields: ["id", "_embedded.author", "_links.author"],
      perPage: 1,
    })) as Array<{
      _embedded?: { author?: unknown[] };
      _links?: { author?: unknown[] };
      id: number;
    }>;

    expect(posts[0]?._links?.author).toBeDefined();
    expect(posts[0]?._embedded?.author).toBeDefined();
  });
});
