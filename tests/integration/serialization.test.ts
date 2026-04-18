import { beforeAll, describe, expect, it } from "vitest";
import type { WordPressBlocksClient } from "../../dist/blocks-entry.js";
import {
  isWordPressClientError,
  type WordPressClient,
  WordPressHttpError,
} from "../../dist/index.js";
import {
  createAuthBlocksClient,
  createAuthClient,
  createPublicClient,
} from "../helpers/wp-client";

/**
 * Verifies that all read helpers return plain serializable DTOs.
 *
 * Returned data must survive `structuredClone()`, `JSON.stringify()`,
 * and cross-boundary transport (SSR, RSC, postMessage, cache).
 * No DTO should contain functions, `then`, `PromiseLike`, or hidden closures.
 */
describe("Client: DTO serialization", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let authBlocksClient: WordPressBlocksClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
    authBlocksClient = createAuthBlocksClient();
  });

  function postsClient(client: WordPressClient) {
    return client.content("posts");
  }

  function pagesClient(client: WordPressClient) {
    return client.content("pages");
  }

  describe("post list DTOs", () => {
    it("content('posts').list() items are structuredClone-safe", async () => {
      const posts = await postsClient(publicClient).list({ perPage: 1 });

      expect(posts.length).toBeGreaterThan(0);

      const cloned = structuredClone(posts);

      expect(cloned[0].id).toBe(posts[0].id);
      expect(cloned[0].slug).toBe(posts[0].slug);
    });

    it("content('posts').list() items have no helper methods or thenable", async () => {
      const posts = await postsClient(publicClient).list({ perPage: 1 });
      const first = posts[0];

      expect("getBlocks" in first).toBe(false);
      expect("getContent" in first).toBe(false);
      expect("get" in first).toBe(false);
      expect("then" in first).toBe(false);
    });

    it("content('posts').list() items round-trip through JSON", async () => {
      const posts = await postsClient(publicClient).list({ perPage: 2 });
      const json = JSON.stringify(posts);
      const parsed = JSON.parse(json);

      expect(parsed[0].slug).toBe(posts[0].slug);
      expect(parsed[0].title.rendered).toBe(posts[0].title.rendered);
    });
  });

  describe("page list DTOs", () => {
    it("content('pages').list() items are structuredClone-safe", async () => {
      const pages = await pagesClient(publicClient).list({ perPage: 1 });

      expect(pages.length).toBeGreaterThan(0);

      const cloned = structuredClone(pages);

      expect(cloned[0].id).toBe(pages[0].id);
    });

    it("content('pages').list() items have no helper methods or thenable", async () => {
      const pages = await pagesClient(publicClient).list({ perPage: 1 });
      const first = pages[0];

      expect("getBlocks" in first).toBe(false);
      expect("getContent" in first).toBe(false);
      expect("get" in first).toBe(false);
      expect("then" in first).toBe(false);
    });
  });

  describe("paginated DTOs", () => {
    it("content('posts').listPaginated().data items are plain DTOs", async () => {
      const result = await postsClient(publicClient).listPaginated({
        perPage: 1,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect("getBlocks" in result.data[0]).toBe(false);

      const cloned = structuredClone(result.data);

      expect(cloned[0].id).toBe(result.data[0].id);
    });

    it("content('pages').listPaginated().data items are plain DTOs", async () => {
      const result = await pagesClient(publicClient).listPaginated({
        perPage: 1,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect("getBlocks" in result.data[0]).toBe(false);

      const cloned = structuredClone(result.data);

      expect(cloned[0].id).toBe(result.data[0].id);
    });
  });

  describe("single-item query resolution", () => {
    it("content('posts').item() resolves to a structuredClone-safe DTO", async () => {
      const lookup = await postsClient(publicClient).item("test-post-001");

      expect(lookup).toBeDefined();

      const post = await postsClient(publicClient).item(lookup!.id);

      expect(post).toBeDefined();

      const cloned = structuredClone(post);

      expect(cloned!.id).toBe(post!.id);
      expect(cloned!.slug).toBe(post!.slug);
    });

    it("content('posts').item() resolves to a plain DTO without helpers", async () => {
      const post = await postsClient(publicClient).item("test-post-001");

      expect(post).toBeDefined();
      expect("getBlocks" in (post as object)).toBe(false);
      expect("then" in (post as object)).toBe(false);

      const json = JSON.stringify(post);
      const parsed = JSON.parse(json);

      expect(parsed.slug).toBe("test-post-001");
    });
  });

  describe("all-posts DTOs", () => {
    it("content('posts').listAll() items are structuredClone-safe", async () => {
      const posts = await postsClient(publicClient).listAll();

      expect(posts.length).toBeGreaterThan(0);

      const cloned = structuredClone(posts.slice(0, 2));

      expect(cloned[0].id).toBe(posts[0].id);
    });

    it("content('posts').listAll() items have no helper methods", async () => {
      const posts = await postsClient(publicClient).listAll();
      const first = posts[0];

      expect("getBlocks" in first).toBe(false);
      expect("getContent" in first).toBe(false);
    });
  });

  describe("error serialization", () => {
    it("WordPressHttpError.toJSON() returns a plain serializable object", async () => {
      try {
        await publicClient
          .content("posts")
          .create({ status: "draft", title: "Serialization: error test" });
        throw new Error("Expected request to fail with auth error.");
      } catch (error) {
        expect(isWordPressClientError(error)).toBe(true);
        expect(error).toBeInstanceOf(WordPressHttpError);

        const httpError = error as WordPressHttpError;
        const serialized = httpError.toJSON();

        expect(serialized.name).toBe("WordPressHttpError");
        expect(serialized.kind).toBe("WP_API_ERROR");
        expect(serialized.retryable).toBe(false);
        expect(serialized.status).toBe(401);
        expect(typeof serialized.statusText).toBe("string");
        expect(typeof serialized.message).toBe("string");

        const json = JSON.stringify(serialized);
        const parsed = JSON.parse(json);

        expect(parsed.kind).toBe("WP_API_ERROR");
        expect(parsed.status).toBe(401);
      }
    });
  });

  describe("list to query block workflow", () => {
    it("iterates post list and retrieves blocks via a new query instance", async () => {
      const posts = await postsClient(authClient).list({ perPage: 5 });

      expect(posts.length).toBeGreaterThan(0);

      const firstWithContent = posts.find(
        (p) => p.content.rendered.trim().length > 0,
      );

      if (!firstWithContent) {
        return;
      }

      const blocks = await authBlocksClient
        .content("posts")
        .item(firstWithContent.id)
        .blocks()
        .get();

      expect(blocks).toBeDefined();
      expect(Array.isArray(blocks)).toBe(true);
    });

    it("iterates page list and retrieves content via a new query instance", async () => {
      const pages = await pagesClient(authClient).list({ perPage: 5 });

      expect(pages.length).toBeGreaterThan(0);

      const content = await pagesClient(authClient)
        .item(pages[0].id)
        .getContent();

      expect(content).toBeDefined();
      expect(typeof content?.raw).toBe("string");
      expect(typeof content?.rendered).toBe("string");
    });
  });
});
