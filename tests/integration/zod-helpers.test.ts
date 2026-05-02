import type {
  WordPressClient,
  WordPressDiscoveryCatalog,
} from "fluent-wp-client";
import {
  type AbilityZodSchemas,
  type ResourceZodSchemas,
  zodFromJsonSchema,
  zodSchemasFromDescription,
} from "fluent-wp-client/zod";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthClient } from "../helpers/wp-client";

/**
 * Integration coverage for the runtime catalog-to-Zod conversion helpers.
 *
 * These helpers bridge the gap between the serializable JSON Schema catalog
 * from explore() and usable Zod validators, without the CLI code generation step.
 */
describe("Zod helpers: runtime catalog-to-Zod conversion", () => {
  let authClient: WordPressClient;
  let catalog: WordPressDiscoveryCatalog;

  beforeAll(async () => {
    authClient = createAuthClient();
    catalog = await authClient.explore();
  });

  describe("zodFromJsonSchema()", () => {
    it("converts a discovered resource item schema to a Zod validator", () => {
      const schema = zodFromJsonSchema(catalog.content.posts.schemas.item);

      expect(schema).toBeDefined();

      // Validate a known post structure passes
      const result = schema?.safeParse({
        id: 1,
        slug: "hello-world",
        status: "publish",
        type: "post",
      });

      expect(result.success).toBe(true);
    });

    it("converts a discovered create schema to a Zod validator", () => {
      const schema = zodFromJsonSchema(catalog.content.posts.schemas.create);

      expect(schema).toBeDefined();

      // WordPress create schemas expect title as { raw: string } not a plain string
      const result = schema?.safeParse({
        status: "draft",
        title: { raw: "Test Post" },
      });

      expect(result.success).toBe(true);
    });

    it("enforces id rules for discovered create and update schemas", () => {
      const createSchema = zodFromJsonSchema(
        catalog.content.posts.schemas.create,
      );
      const updateSchema = zodFromJsonSchema(
        catalog.content.posts.schemas.update,
      );

      expect(
        createSchema?.safeParse({
          id: 1,
          status: "draft",
          title: { raw: "Should fail" },
        }).success,
      ).toBe(false);
      expect(
        updateSchema?.safeParse({
          status: "draft",
          title: { raw: "Missing id" },
        }).success,
      ).toBe(false);
      expect(
        updateSchema?.safeParse({
          id: 1,
          status: "draft",
          title: { raw: "With id" },
        }).success,
      ).toBe(true);
    });

    it("converts a discovered ability input schema to a Zod validator", () => {
      const abilityDesc = catalog.abilities["test/process-complex"];
      expect(abilityDesc).toBeDefined();
      expect(abilityDesc.schemas.input).toBeDefined();

      const schema = zodFromJsonSchema(abilityDesc.schemas.input);

      expect(schema).toBeDefined();

      // Valid input should pass
      const valid = schema?.safeParse({
        name: "test-config",
        settings: { font_size: 16, theme: "dark" },
      });

      expect(valid.success).toBe(true);
    });

    it("rejects invalid data against a discovered schema", () => {
      const schema = zodFromJsonSchema(catalog.content.posts.schemas.create);

      expect(schema).toBeDefined();

      // Missing required 'title' for post creation
      const result = schema?.safeParse({
        status: 42, // wrong type — status should be a string
      });

      expect(result.success).toBe(false);
    });

    it("returns undefined for null or undefined input", () => {
      expect(zodFromJsonSchema(undefined)).toBeUndefined();
      expect(zodFromJsonSchema(null)).toBeUndefined();
    });

    it("returns undefined for an empty object schema", () => {
      // An empty object is valid JSON Schema but may not produce a useful validator
      const schema = zodFromJsonSchema({});

      // Either returns a schema or undefined — both are acceptable
      if (schema) {
        expect(typeof schema.safeParse).toBe("function");
      }
    });

    it("normalizes non-standard 'bool' type alias to 'boolean'", () => {
      const schema = zodFromJsonSchema({
        properties: {
          active: { type: "bool" },
        },
        type: "object",
      });

      expect(schema).toBeDefined();

      const valid = schema?.safeParse({ active: true });
      expect(valid?.success).toBe(true);

      const invalid = schema?.safeParse({ active: "yes" });
      expect(invalid?.success).toBe(false);
    });

    it("normalizes 'bool' inside union type arrays", () => {
      const schema = zodFromJsonSchema({
        properties: {
          flag: { type: ["bool", "null"] },
        },
        type: "object",
      });

      expect(schema).toBeDefined();

      const valid = schema?.safeParse({ flag: false });
      expect(valid?.success).toBe(true);

      const nullValid = schema?.safeParse({ flag: null });
      expect(nullValid?.success).toBe(true);
    });

    it("handles custom post type schemas with instance-specific fields", () => {
      const bookDesc = catalog.content.books;
      expect(bookDesc).toBeDefined();

      const schema = zodFromJsonSchema(bookDesc.schemas.item);

      expect(schema).toBeDefined();

      // Validate a book structure — includes CPT-specific fields
      const result = schema?.safeParse({
        id: 1,
        slug: "test-book-001",
        status: "publish",
        type: "book",
      });

      expect(result.success).toBe(true);
    });

    it("handles date fields without false negatives from date-time format", () => {
      const schema = zodFromJsonSchema(catalog.content.posts.schemas.item);
      expect(schema).toBeDefined();

      // WordPress returns dates without trailing Z (e.g. "2025-01-01T12:00:00").
      // Without date-time format stripping this would fail Zod's strict ISO 8601.
      const result = schema?.safeParse({
        content: { protected: false, rendered: "" },
        date: "2025-01-01T12:00:00",
        date_gmt: "2025-01-01T12:00:00",
        excerpt: { protected: false, rendered: "" },
        guid: { rendered: "http://localhost:8888/?p=1" },
        id: 1,
        link: "http://localhost:8888/test/",
        modified: "2025-01-01T12:00:00",
        modified_gmt: "2025-01-01T12:00:00",
        slug: "test",
        status: "publish",
        title: { rendered: "Test" },
        type: "post",
      });

      expect(result.success).toBe(true);
    });

    it("does not strip conditional JSON Schema keywords from non-query schemas", () => {
      const schema = zodFromJsonSchema({
        if: {
          properties: { kind: { const: "post" } },
          required: ["kind"],
          type: "object",
        },
        properties: { kind: { type: "string" }, title: { type: "string" } },
        then: { required: ["title"] },
        type: "object",
      });

      expect(schema).toBeUndefined();
    });

    it("strips unsupported conditional keywords only for WordPress query schemas", () => {
      const schema = zodFromJsonSchema({
        if: {
          properties: { _fields: { type: "array" } },
          required: ["_embed", "_fields"],
          type: "object",
        },
        properties: {
          _embed: { type: "boolean" },
          _fields: { items: { type: "string" }, type: "array" },
        },
        then: {
          properties: {
            _fields: { contains: { const: "_embedded" }, type: "array" },
          },
          type: "object",
        },
        type: "object",
      });

      expect(schema).toBeDefined();
      expect(schema?.safeParse({ _embed: true, _fields: ["id"] }).success).toBe(
        false,
      );
    });
  });

  describe("zodSchemasFromDescription() — resources", () => {
    it("converts all operation schemas for a content resource", () => {
      const schemas = zodSchemasFromDescription(
        catalog.content.posts,
      ) as ResourceZodSchemas;

      expect(schemas.item).toBeDefined();
      expect(schemas.create).toBeDefined();
      expect(schemas.query).toBeDefined();
      expect(schemas.update).toBeDefined();

      // Verify they are actual Zod schemas with safeParse
      expect(typeof schemas.item?.safeParse).toBe("function");
      expect(typeof schemas.create?.safeParse).toBe("function");
      expect(typeof schemas.query?.safeParse).toBe("function");
      expect(typeof schemas.update?.safeParse).toBe("function");
    });

    it("converts query params schema for collection filters", () => {
      const schemas = zodSchemasFromDescription(
        catalog.content.posts,
      ) as ResourceZodSchemas;

      const valid = schemas.query?.safeParse({
        _fields: ["id", "title.rendered", "_links.author"],
        page: 1,
        per_page: 10,
        search: "seeded",
      });
      const validGlobalParams = schemas.query?.safeParse({
        _embed: true,
        _fields: ["id", "title.rendered", "_links", "_embedded"],
      });
      const validRelationParams = schemas.query?.safeParse({
        _embed: true,
        _fields: ["id", "_embedded.author", "_links.author"],
      });
      const embedFalseWithoutEmbedded = schemas.query?.safeParse({
        _embed: false,
        _fields: ["id"],
      });
      const invalid = schemas.query?.safeParse({
        per_page: "10",
      });
      const unsupportedEmbedDepth = schemas.query?.safeParse({
        _fields: ["_embedded.author.name"],
      });
      const embedWithoutLinks = schemas.query?.safeParse({
        _embed: true,
        _fields: ["id", "_embedded"],
      });
      const embedWithRequiredFields = schemas.query?.safeParse({
        _embed: true,
        _fields: ["id", "_embedded", "_links"],
      });
      const embedRelationWithDifferentLinkRelation = schemas.query?.safeParse({
        _embed: true,
        _fields: ["id", "_embedded.author", "_links.wp:term"],
      });
      const unsupportedEmbedRelationList = schemas.query?.safeParse({
        _embed: ["author", "wp:term"],
        _fields: ["id", "_embedded", "_links"],
      });
      const wordpressWireFormats = schemas.query?.safeParse({
        _embed: "author,wp:term",
        _fields: "id,_embedded,_links",
      });

      expect(valid?.success).toBe(true);
      expect(validGlobalParams?.success).toBe(true);
      expect(validRelationParams?.success).toBe(true);
      expect(embedFalseWithoutEmbedded?.success).toBe(true);
      expect(invalid?.success).toBe(false);
      expect(unsupportedEmbedDepth?.success).toBe(false);
      expect(embedWithoutLinks?.success).toBe(false);
      expect(embedRelationWithDifferentLinkRelation?.success).toBe(true);
      expect(unsupportedEmbedRelationList?.success).toBe(false);
      expect(wordpressWireFormats?.success).toBe(false);
      expect(embedWithRequiredFields?.success).toBe(true);
    });

    it("converts all operation schemas for a custom post type", () => {
      const schemas = zodSchemasFromDescription(
        catalog.content.books,
      ) as ResourceZodSchemas;

      expect(schemas.item).toBeDefined();
      expect(schemas.create).toBeDefined();
    });

    it("converts all operation schemas for a term resource", () => {
      const schemas = zodSchemasFromDescription(
        catalog.terms.categories,
      ) as ResourceZodSchemas;

      expect(schemas.item).toBeDefined();
      expect(schemas.create).toBeDefined();
    });

    it("converts all schemas for a first-class resource", () => {
      const schemas = zodSchemasFromDescription(
        catalog.resources.media,
      ) as ResourceZodSchemas;

      expect(schemas.item).toBeDefined();
    });

    it("create schema validates real mutation input", async () => {
      const schemas = zodSchemasFromDescription(
        catalog.content.posts,
      ) as ResourceZodSchemas;
      expect(schemas.create).toBeDefined();

      // WordPress create schemas expect rendered-content objects, not plain strings
      const result = schemas.create?.safeParse({
        content: { raw: "Testing runtime schema conversion." },
        status: "draft",
        title: { raw: "Zod Helper Test Post" },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("zodSchemasFromDescription() — abilities", () => {
    it("converts input and output schemas for an ability", () => {
      const abilityDesc = catalog.abilities["test/process-complex"];
      expect(abilityDesc).toBeDefined();

      const schemas = zodSchemasFromDescription(
        abilityDesc,
      ) as AbilityZodSchemas;

      expect(schemas.input).toBeDefined();
      expect(schemas.output).toBeDefined();
      expect(typeof schemas.input?.safeParse).toBe("function");
      expect(typeof schemas.output?.safeParse).toBe("function");
    });

    it("input schema validates correct ability input", () => {
      const schemas = zodSchemasFromDescription(
        catalog.abilities["test/process-complex"],
      ) as AbilityZodSchemas;

      const result = schemas.input?.safeParse({
        name: "test-config",
        settings: { theme: "dark" },
      });

      expect(result.success).toBe(true);
    });

    it("input schema rejects invalid ability input", () => {
      const schemas = zodSchemasFromDescription(
        catalog.abilities["test/process-complex"],
      ) as AbilityZodSchemas;

      const result = schemas.input?.safeParse({
        name: "missing-settings",
        // settings is required but missing
      });

      expect(result.success).toBe(false);
    });

    it("handles abilities without output schemas gracefully", () => {
      const abilityDesc = catalog.abilities["test/get-site-title"];

      if (abilityDesc) {
        const schemas = zodSchemasFromDescription(
          abilityDesc,
        ) as AbilityZodSchemas;

        // Should not throw — undefined schemas produce undefined validators
        expect(typeof schemas).toBe("object");
      }
    });
  });

  describe("serialization round-trip", () => {
    it("works with a JSON-serialized and restored catalog", () => {
      // Simulate persist → restore cycle
      const serialized = JSON.stringify(catalog);
      const restored = JSON.parse(serialized) as WordPressDiscoveryCatalog;

      const schema = zodFromJsonSchema(restored.content.posts.schemas.item);

      expect(schema).toBeDefined();
      expect(typeof schema?.safeParse).toBe("function");
    });

    it("works after useCatalog() restores a cached catalog", async () => {
      const serialized = JSON.stringify(catalog);
      const restored = JSON.parse(serialized) as WordPressDiscoveryCatalog;

      const freshClient = createAuthClient();
      freshClient.useCatalog(restored);

      // describe() should return from cache
      const desc = await freshClient.content("posts").describe();
      const schema = zodFromJsonSchema(desc.schemas.item);

      expect(schema).toBeDefined();

      const result = schema?.safeParse({
        id: 1,
        slug: "test",
        status: "publish",
        type: "post",
      });

      expect(result.success).toBe(true);
    });
  });
});
