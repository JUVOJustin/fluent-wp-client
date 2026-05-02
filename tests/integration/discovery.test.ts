import {
  createDiscoveryMethods,
  WordPressClient,
  type WordPressResourceSchemaSet,
  type WordPressRuntime,
} from "fluent-wp-client";
import { zodFromJsonSchema } from "fluent-wp-client/zod";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createAuthClient,
  createPublicClient,
  getBaseUrl,
} from "../helpers/wp-client";

/**
 * Integration tests for JSON Schema discovery APIs.
 *
 * These tests verify the discovery functionality that exposes payload shapes
 * for WordPress REST resources and abilities.
 */
describe("Discovery APIs", () => {
  let authClient: WordPressClient;

  beforeAll(() => {
    // Discovery requires authentication to access /types and /taxonomies endpoints
    authClient = createAuthClient();
  });

  describe("wp.content().describe()", () => {
    it("returns schema description for posts", async () => {
      const description = await authClient.content("posts").describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("content");
      expect(description.resource).toBe("posts");
      expect(description.namespace).toBe("wp/v2");
      expect(description.route).toBe("/wp-json/wp/v2/posts");
      expect(description.schemas).toBeDefined();
      expect(description.schemas.item).toBeDefined();
      expect(description.schemas.collection).toBeDefined();
      // Note: create/update schemas may not be available depending on WP version/permissions
    });

    it("returns schema description for pages", async () => {
      const description = await authClient.content("pages").describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("content");
      expect(description.resource).toBe("pages");
      expect(description.schemas).toBeDefined();
    });

    it("returns schema description for custom post types", async () => {
      const description = await authClient.content("books").describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("content");
      expect(description.resource).toBe("books");
      expect(description.schemas).toBeDefined();
    });

    it("returns serializable resource descriptions without dropping schema keys", async () => {
      const description = await authClient.content("posts").describe();

      expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    });
  });

  describe("resource getSchemaValue()", () => {
    it("reads raw values from the item schema by path", async () => {
      const titleType = await authClient
        .content("posts")
        .getSchemaValue("properties.title.type");

      expect(titleType).toBe("object");
    });

    it("reads plugin-added ACF choice metadata by raw schema path", async () => {
      const choices = await authClient
        .content("posts")
        .getSchemaValue<Array<{ label: string; value: string }>>(
          "properties.acf.properties.acf_status.choices",
        );

      expect(choices).toEqual([
        { label: "Draft", value: "draft" },
        { label: "Ready for review", value: "ready" },
        { label: "Queued for publish", value: "queued" },
      ]);
    });

    it("supports looking up values from non-item schema variants", async () => {
      const statusType = await authClient
        .content("posts")
        .getSchemaValue("properties.status.type", { schema: "create" });

      expect(statusType).toBe("string");
    });

    it("returns undefined for missing schema paths", async () => {
      const value = await authClient
        .content("posts")
        .getSchemaValue("properties.acf.properties.missing_field.choices");

      expect(value).toBeUndefined();
    });
  });

  describe("wp.terms().describe()", () => {
    it("returns schema description for categories", async () => {
      const description = await authClient.terms("categories").describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("term");
      expect(description.resource).toBe("categories");
      expect(description.namespace).toBe("wp/v2");
      expect(description.schemas).toBeDefined();
      expect(description.schemas.item).toBeDefined();
      expect(description.schemas.collection).toBeDefined();
    });

    it("returns schema description for tags", async () => {
      const description = await authClient.terms("tags").describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("term");
      expect(description.resource).toBe("tags");
      expect(description.schemas).toBeDefined();
    });
  });

  describe("first-class resource .describe()", () => {
    it("returns schema description for media", async () => {
      const description = await authClient.media().describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("resource");
      expect(description.resource).toBe("media");
      expect(description.route).toBe("/wp-json/wp/v2/media");
      expect(description.schemas.item).toBeDefined();
      expect(description.schemas.collection).toBeDefined();
    });

    it("returns schema description for comments", async () => {
      const description = await authClient.comments().describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("resource");
      expect(description.resource).toBe("comments");
      expect(description.route).toBe("/wp-json/wp/v2/comments");
      expect(description.schemas.item).toBeDefined();
    });

    it("returns schema description for users", async () => {
      const description = await authClient.users().describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("resource");
      expect(description.resource).toBe("users");
      expect(description.route).toBe("/wp-json/wp/v2/users");
      expect(description.schemas.item).toBeDefined();
    });

    it("returns schema description for settings", async () => {
      const description = await authClient.settings().describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("resource");
      expect(description.resource).toBe("settings");
      expect(description.route).toBe("/wp-json/wp/v2/settings");
      expect(description.schemas.item).toBeDefined();
    });
  });

  describe("wp.ability().describe()", () => {
    it("returns schema description for an ability", async () => {
      const description = await authClient
        .ability("test/process-complex")
        .describe();

      expect(description).toBeDefined();
      expect(description.kind).toBe("ability");
      expect(description.name).toBe("test/process-complex");
      expect(description.route).toContain(
        "/wp-json/wp-abilities/v1/abilities/test/process-complex",
      );
      expect(description.schemas).toBeDefined();
    });

    it("returns serializable ability descriptions without dropping schema keys", async () => {
      const description = await authClient
        .ability("test/process-complex")
        .describe();

      expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    });
  });

  describe("wp.explore()", () => {
    it("returns full catalog of discoverable resources", async () => {
      const catalog = await authClient.explore();

      expect(catalog).toBeDefined();
      expect(catalog.content).toBeDefined();
      expect(catalog.terms).toBeDefined();
      expect(catalog.resources).toBeDefined();
      expect(catalog.abilities).toBeDefined();

      // Verify posts are discovered
      expect(catalog.content.posts).toBeDefined();
      expect(catalog.content.posts.kind).toBe("content");
      expect(catalog.content.posts.schemas).toBeDefined();

      // Verify pages are discovered
      expect(catalog.content.pages).toBeDefined();

      // Verify books (custom post type) are discovered
      expect(catalog.content.books).toBeDefined();

      // Verify terms are discovered
      expect(catalog.terms.categories).toBeDefined();
      expect(catalog.terms.tags).toBeDefined();

      // Verify first-class resources are discovered
      expect(catalog.resources.media).toBeDefined();
      expect(catalog.resources.users).toBeDefined();
      expect(catalog.resources.comments).toBeDefined();
      expect(catalog.resources.settings).toBeDefined();
    });

    it("supports include option to limit discovery scope", async () => {
      const catalog = await authClient.explore({ include: ["content"] });

      expect(catalog).toBeDefined();
      expect(Object.keys(catalog.content).length).toBeGreaterThan(0);
      expect(Object.keys(catalog.terms).length).toBe(0);
      expect(Object.keys(catalog.resources).length).toBe(0);
      expect(Object.keys(catalog.abilities).length).toBe(0);
    });

    it("does not treat a partial explore() result as the cached full catalog", async () => {
      const client = createAuthClient();

      const partialCatalog = await client.explore({ include: ["content"] });
      expect(Object.keys(partialCatalog.terms).length).toBe(0);

      const fullCatalog = await client.explore();
      expect(Object.keys(fullCatalog.terms).length).toBeGreaterThan(0);
      expect(Object.keys(fullCatalog.resources).length).toBeGreaterThan(0);
      expect(Object.keys(fullCatalog.abilities).length).toBeGreaterThan(0);
    });

    it("returns serializable DTOs", async () => {
      const catalog = await authClient.explore();

      // Test structuredClone compatibility
      const cloned = structuredClone(catalog);
      expect(cloned).toEqual(catalog);

      // Test JSON serialization
      const json = JSON.stringify(catalog);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(catalog);

      // Ensure no functions in catalog
      expect(typeof catalog.content.posts.schemas).toBe("object");
      expect(
        typeof JSON.parse(JSON.stringify(catalog.content.posts.schemas)),
      ).toBe("object");
    });

    it("reuses one REST index fetch across resource discovery", async () => {
      const fetchedEndpoints: string[] = [];
      const endpointSchema = {
        endpoints: [
          {
            args: {
              page: { type: "integer" },
              per_page: { type: "integer" },
            },
            methods: ["GET"],
          },
        ],
        schema: {
          properties: { id: { type: "integer" }, title: { type: "object" } },
          type: "object",
        },
      };
      const runtime: WordPressRuntime = {
        fetchAPI: async (endpoint) => {
          fetchedEndpoints.push(endpoint);

          if (endpoint === "/wp-json/") {
            return { routes: {} } as never;
          }

          if (endpoint === "/wp-json/wp/v2/types") {
            return {
              mock: {
                rest_base: "mock-posts",
                rest_namespace: "wp/v2",
                slug: "mock",
              },
            } as never;
          }

          return {} as never;
        },
        fetchAPIPaginated: async () => ({
          data: [],
          total: 0,
          totalPages: 0,
        }),
        hasAuth: () => true,
        request: async () => ({
          data: endpointSchema,
          response: new Response(null, { status: 200 }),
        }),
      };

      await createDiscoveryMethods(runtime).explore({
        include: ["content", "resources"],
      });

      expect(
        fetchedEndpoints.filter((endpoint) => endpoint === "/wp-json/"),
      ).toHaveLength(1);
    });

    it("does not probe resources missing from the REST index during explore()", async () => {
      const requestedEndpoints: string[] = [];
      const runtime: WordPressRuntime = {
        fetchAPI: async (endpoint) => {
          if (endpoint === "/wp-json/") {
            return { routes: {} } as never;
          }

          if (endpoint === "/wp-json/wp/v2/types") {
            return {
              mock: {
                rest_base: "missing-posts",
                rest_namespace: "wp/v2",
                slug: "mock",
              },
            } as never;
          }

          return {} as never;
        },
        fetchAPIPaginated: async () => ({
          data: [],
          total: 0,
          totalPages: 0,
        }),
        hasAuth: () => true,
        request: async (options) => {
          requestedEndpoints.push(options.endpoint);
          return {
            data: {},
            response: new Response(null, { status: 200 }),
          };
        },
      };

      const catalog = await createDiscoveryMethods(runtime).explore({
        include: ["content"],
      });

      expect(requestedEndpoints).toEqual([]);
      expect(catalog.content["missing-posts"]).toBeUndefined();
    });

    it("deduplicates shared endpoint schema requests during explore()", async () => {
      const requestedEndpoints: string[] = [];
      const endpointSchema = {
        endpoints: [
          {
            args: {
              context: { type: "string" },
            },
            methods: ["GET"],
          },
          {
            args: {
              title: { type: "string" },
            },
            methods: ["POST"],
          },
        ],
        schema: {
          properties: { id: { type: "integer" }, title: { type: "object" } },
          type: "object",
        },
      };
      const runtime: WordPressRuntime = {
        fetchAPI: async (endpoint) => {
          if (endpoint === "/wp-json/") {
            return {
              routes: {
                "/wp/v2/media": endpointSchema,
                "/wp/v2/media/(?P<id>[\\d]+)": endpointSchema,
              },
            } as never;
          }

          if (endpoint === "/wp-json/wp/v2/types") {
            return {
              attachment: {
                rest_base: "media",
                rest_namespace: "wp/v2",
                slug: "attachment",
              },
            } as never;
          }

          return {} as never;
        },
        fetchAPIPaginated: async () => ({
          data: [],
          total: 0,
          totalPages: 0,
        }),
        hasAuth: () => true,
        request: async (options) => {
          requestedEndpoints.push(options.endpoint);
          return {
            data: endpointSchema,
            response: new Response(null, { status: 200 }),
          };
        },
      };

      const catalog = await createDiscoveryMethods(runtime).explore({
        include: ["content", "resources"],
      });

      expect(catalog.content.media).toBeDefined();
      expect(catalog.resources.media).toBeDefined();
      expect(
        requestedEndpoints.filter(
          (endpoint) => endpoint === "/wp-json/wp/v2/media",
        ),
      ).toHaveLength(1);
    });

    it("uses common item query params when an item route schema is unavailable", async () => {
      const collectionEndpointSchema = {
        endpoints: [
          {
            args: {
              page: { type: "integer" },
              per_page: { type: "integer" },
              search: { type: "string" },
            },
            methods: ["GET"],
          },
        ],
        schema: {
          properties: { id: { type: "integer" }, title: { type: "object" } },
          type: "object",
        },
      };
      const runtime: WordPressRuntime = {
        fetchAPI: async (endpoint) => {
          if (endpoint === "/wp-json/") {
            return { routes: {} } as never;
          }

          if (endpoint === "/wp-json/wp/v2/types") {
            return {
              mock: {
                rest_base: "mock-posts",
                rest_namespace: "wp/v2",
                slug: "mock",
              },
            } as never;
          }

          return {} as never;
        },
        fetchAPIPaginated: async () => ({
          data: [],
          total: 0,
          totalPages: 0,
        }),
        hasAuth: () => true,
        request: async () => ({
          data: collectionEndpointSchema,
          response: new Response(null, { status: 200 }),
        }),
      };

      const description =
        await createDiscoveryMethods(runtime).describeContent("mock-posts");
      const itemProperties = description.capabilities.queryParams.item
        .properties as Record<string, unknown>;

      expect(itemProperties.context).toMatchObject({ type: "string" });
      expect(itemProperties._fields).toBeDefined();
      expect(itemProperties._embed).toBeDefined();
      expect(itemProperties.page).toBeUndefined();
      expect(itemProperties.per_page).toBeUndefined();
      expect(itemProperties.search).toBeUndefined();
    });
  });

  /**
   * capabilities field: normalized DX surface derived from raw OPTIONS data.
   */
  describe("capabilities on describe()", () => {
    it("content describe() includes capabilities with query params schema", async () => {
      const desc = await authClient.content("posts").describe();

      expect(desc.capabilities).toBeDefined();
      expect(desc.capabilities?.queryParams.collection).toMatchObject({
        properties: {
          _embed: { type: "boolean" },
          _fields: { items: expect.any(Object), type: "array" },
          per_page: { type: "integer" },
          search: { type: "string" },
        },
        type: "object",
      });
      expect(desc.capabilities?.queryParams.item).toMatchObject({
        properties: {
          _embed: { type: "boolean" },
          _fields: { items: expect.any(Object), type: "array" },
          context: { type: "string" },
        },
        type: "object",
      });
    });

    it("item schema includes known readable post fields", async () => {
      const desc = await authClient.content("posts").describe();

      const fields = Object.keys(desc.schemas.item?.properties ?? {});
      expect(fields).toContain("id");
      expect(fields).toContain("slug");
      expect(fields).toContain("title");
      expect(fields).toContain("content");
    });

    it("create schema includes known writable fields", async () => {
      const desc = await authClient.content("posts").describe();

      // Create schema is built from POST args — common fields should be present
      expect(
        Object.keys(desc.schemas.create?.properties ?? {}).length,
      ).toBeGreaterThan(0);
    });

    it("create forbids id while update requires id", async () => {
      const desc = await authClient.content("posts").describe();
      const createProperties = desc.schemas.create?.properties as
        | Record<string, unknown>
        | undefined;
      const updateProperties = desc.schemas.update?.properties as
        | Record<string, unknown>
        | undefined;

      expect(createProperties?.id).toBe(false);
      expect(updateProperties?.id).toMatchObject({ type: "integer" });
      expect(desc.schemas.update?.required).toEqual(["id"]);
    });

    it("terms describe() includes capabilities", async () => {
      const desc = await authClient.terms("categories").describe();

      expect(desc.capabilities).toBeDefined();
      expect(desc.capabilities?.queryParams.collection.type).toBe("object");
      expect(desc.capabilities?.queryParams.item.type).toBe("object");
    });

    it("first-class resource describe() includes capabilities", async () => {
      const desc = await authClient.media().describe();

      expect(desc.capabilities).toBeDefined();
      expect(desc.capabilities?.queryParams.collection.type).toBe("object");
    });

    it("capabilities survive JSON round-trip", async () => {
      const desc = await authClient.content("posts").describe();
      const roundTripped = JSON.parse(JSON.stringify(desc));

      expect(roundTripped.capabilities).toEqual(desc.capabilities);
    });

    it("explore() catalog descriptions include capabilities", async () => {
      const catalog = await authClient.explore({ include: ["content"] });

      const postsDesc = catalog.content.posts;
      expect(postsDesc.capabilities).toBeDefined();
      expect(postsDesc.capabilities?.queryParams.collection.type).toBe(
        "object",
      );
    });
  });

  /**
   * wp.useCatalog(): lazily seed the internal discovery cache from external data.
   */
  describe("wp.useCatalog()", () => {
    it("returns the client instance for chaining", async () => {
      const catalog = await authClient.explore();
      const client = createPublicClient();

      const result = client.useCatalog(catalog);

      expect(result).toBe(client);
    });

    it("seeded describe() returns the same data as the original catalog", async () => {
      const catalog = await authClient.explore();

      const freshClient = new WordPressClient({
        baseUrl: getBaseUrl(),
      });
      freshClient.useCatalog(catalog);

      const postsDesc = await freshClient.content("posts").describe();

      expect(postsDesc.resource).toBe("posts");
      expect(postsDesc.capabilities).toBeDefined();
      expect(postsDesc.capabilities?.queryParams).toEqual(
        catalog.content.posts.capabilities?.queryParams,
      );
    });

    it("seeded explore() returns the catalog without a network round-trip", async () => {
      const original = await authClient.explore();

      // Public client cannot run explore() on its own without errors on some endpoints,
      // but after useCatalog it should return the seeded data immediately.
      const freshClient = new WordPressClient({ baseUrl: getBaseUrl() });
      freshClient.useCatalog(original);

      const catalog = await freshClient.explore();

      expect(catalog.content.posts).toBeDefined();
      expect(Object.keys(catalog.content)).toEqual(
        Object.keys(original.content),
      );
    });

    it("seeded catalog survives JSON.stringify → useCatalog round-trip", async () => {
      const original = await authClient.explore();

      // Simulate storing and loading from a KV store
      const stored = JSON.parse(JSON.stringify(original));

      const freshClient = new WordPressClient({ baseUrl: getBaseUrl() });
      freshClient.useCatalog(stored);

      const postsDesc = await freshClient.content("posts").describe();
      expect(postsDesc.capabilities).toBeDefined();
      expect(postsDesc.capabilities?.queryParams).toEqual(
        original.content.posts.capabilities?.queryParams,
      );
    });

    it("useCatalog() does not prevent refresh via explore({ refresh: true })", async () => {
      const original = await authClient.explore();

      const freshClient = createAuthClient();
      freshClient.useCatalog(original);

      // Force a refresh — should not throw and should still return valid data
      const refreshed = await freshClient.explore({ refresh: true });

      expect(refreshed.content.posts).toBeDefined();
    });
  });

  /**
   * Dogfooding tests: Verify discovered schemas can be used with Zod
   */
  describe("Dogfooding: Using discovered schemas", () => {
    it("converts discovered schemas to Zod when available", async () => {
      const description = await authClient.content("posts").describe();

      // If create schema is available, it should be convertible to Zod
      if (description.schemas.create) {
        const createSchema = zodFromJsonSchema(description.schemas.create);
        expect(createSchema).toBeDefined();
      }

      // If item schema is available, it should be convertible to Zod
      if (description.schemas.item) {
        const itemSchema = zodFromJsonSchema(description.schemas.item);
        expect(itemSchema).toBeDefined();
      }
    });

    it("uses discovered schema as a Zod validator for a create mutation", async () => {
      const createdIds: number[] = [];

      try {
        const description = await authClient.content("books").describe();

        // create schema is always present now that endpoint arg discovery is correct
        expect(description.schemas.create).toBeDefined();

        const createJsonSchema = description.schemas.create;
        if (!createJsonSchema) {
          throw new Error("Expected books create schema to be available.");
        }

        const createSchema = zodFromJsonSchema(createJsonSchema);
        if (!createSchema) {
          throw new Error("Expected books create schema to convert to Zod.");
        }

        // Validate payload locally before sending it to WordPress
        const validated = createSchema.parse({
          content: { raw: "Created with schema validation" },
          status: "draft",
          title: { raw: "Dogfooding Test Book" },
        });

        const book = (await authClient.content("books").create(validated)) as {
          id: number;
          type: string;
        };

        expect(book).toBeDefined();
        expect(book.type).toBe("book");
        createdIds.push(book.id);
      } finally {
        for (const id of createdIds) {
          await authClient
            .content("books")
            .delete(id, { force: true })
            .catch(() => undefined);
        }
      }
    });
  });

  /**
   * getStandardSchema() tests: Verify JSON Schema → Standard Schema conversion
   */
  describe("getStandardSchema()", () => {
    it("returns a Standard Schema for a create schema", async () => {
      const standard = await authClient
        .content("posts")
        .getStandardSchema("create");
      expect(standard).toBeDefined();
      expect(typeof standard["~standard"].validate).toBe("function");
    });

    it("validates a correct payload", async () => {
      const standard = await authClient
        .content("posts")
        .getStandardSchema("create");
      const result = await standard["~standard"].validate({
        status: "draft",
        title: { raw: "Valid Post" },
      });
      expect(result.issues).toBeUndefined();
      expect(result.value).toBeDefined();
    });

    it("rejects an invalid payload", async () => {
      const standard = await authClient
        .content("posts")
        .getStandardSchema("create");
      const result = await standard["~standard"].validate({
        status: 42,
      });
      expect(result.issues).toBeDefined();
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("works after useCatalog() restores a cached catalog", async () => {
      const catalog = await authClient.explore();
      const stored = JSON.stringify(catalog);
      const restored = JSON.parse(stored);

      const freshClient = createPublicClient();
      freshClient.useCatalog(restored);

      const standard = await freshClient
        .content("posts")
        .getStandardSchema("item");
      expect(typeof standard["~standard"].validate).toBe("function");
    });

    it("throws when the requested schema variant is missing", async () => {
      await expect(
        authClient
          .content("posts")
          .getStandardSchema("delete" as keyof WordPressResourceSchemaSet),
      ).rejects.toThrow("No delete JSON Schema is available");
    });
  });
});
