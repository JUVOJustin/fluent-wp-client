import { WordPressClient } from "fluent-wp-client";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
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
  });

  /**
   * capabilities field: normalized DX surface derived from raw OPTIONS data.
   */
  describe("capabilities on describe()", () => {
    it("content describe() includes capabilities with string arrays", async () => {
      const desc = await authClient.content("posts").describe();

      expect(desc.capabilities).toBeDefined();
      expect(Array.isArray(desc.capabilities?.queryParams)).toBe(true);
      expect(Array.isArray(desc.capabilities?.readFields)).toBe(true);
      expect(Array.isArray(desc.capabilities?.createFields)).toBe(true);
      expect(Array.isArray(desc.capabilities?.updateFields)).toBe(true);
    });

    it("content capabilities.readFields includes known post fields", async () => {
      const desc = await authClient.content("posts").describe();

      const { readFields } = desc.capabilities!;
      expect(readFields).toContain("id");
      expect(readFields).toContain("slug");
      expect(readFields).toContain("title");
      expect(readFields).toContain("content");
    });

    it("content capabilities.createFields includes known writable fields", async () => {
      const desc = await authClient.content("posts").describe();

      // Create schema is built from POST args — common fields should be present
      expect(desc.capabilities?.createFields.length).toBeGreaterThan(0);
    });

    it("content capabilities.updateFields matches createFields (no required constraint)", async () => {
      const desc = await authClient.content("posts").describe();

      // update removes required; properties should be the same set
      expect(desc.capabilities?.updateFields).toEqual(
        desc.capabilities?.createFields,
      );
    });

    it("terms describe() includes capabilities", async () => {
      const desc = await authClient.terms("categories").describe();

      expect(desc.capabilities).toBeDefined();
      expect(Array.isArray(desc.capabilities?.queryParams)).toBe(true);
      expect(Array.isArray(desc.capabilities?.readFields)).toBe(true);
    });

    it("first-class resource describe() includes capabilities", async () => {
      const desc = await authClient.media().describe();

      expect(desc.capabilities).toBeDefined();
      expect(Array.isArray(desc.capabilities?.readFields)).toBe(true);
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
      expect(Array.isArray(postsDesc.capabilities?.readFields)).toBe(true);
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
      expect(postsDesc.capabilities?.readFields).toEqual(
        catalog.content.posts.capabilities?.readFields,
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
      expect(postsDesc.capabilities?.readFields).toEqual(
        original.content.posts.capabilities?.readFields,
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
        const createSchema = z.fromJSONSchema(description.schemas.create);
        expect(createSchema).toBeDefined();
      }

      // If item schema is available, it should be convertible to Zod
      if (description.schemas.item) {
        const itemSchema = z.fromJSONSchema(description.schemas.item);
        expect(itemSchema).toBeDefined();
      }
    });

    it("uses discovered schema as a Zod validator for a create mutation", async () => {
      const createdIds: number[] = [];

      try {
        const description = await authClient.content("books").describe();

        // create schema is always present now that endpoint arg discovery is correct
        expect(description.schemas.create).toBeDefined();

        const createSchema = z.fromJSONSchema(description.schemas.create!);

        // Valid create request should succeed
        const book = (await authClient.content("books").create(
          {
            content: "Created with schema validation",
            status: "draft",
            title: "Dogfooding Test Book",
          },
          createSchema,
        )) as { id: number; type: string };

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
});
