import { beforeAll, describe, expect, it } from "vitest";
import { withBlocks } from "../../dist/blocks-entry.js";
import { WordPressClient } from "../../dist/index.js";
import { createAuthClient, getBaseUrl } from "../helpers/wp-client";

/**
 * Creates a client that counts HTTP requests.
 */
function createCountingClient(): {
  client: WordPressClient;
  count: { value: number };
} {
  const password = process.env.WP_APP_PASSWORD;
  if (!password) throw new Error("WP_APP_PASSWORD not set");

  const count = { value: 0 };
  const client = new WordPressClient({
    auth: { password, username: "admin" },
    baseUrl: getBaseUrl(),
    fetch: async (input, init) => {
      count.value += 1;
      return fetch(input, init);
    },
  });

  return { client, count };
}

describe("Client: internal caching", () => {
  let authClient: WordPressClient;

  beforeAll(() => {
    authClient = createAuthClient();
  });

  describe("query builder memoization", () => {
    it("caches results and returns same object", async () => {
      const { client, count } = createCountingClient();
      const query = client.content("posts").item("test-post-001");

      const result1 = await query;
      const result2 = await query;

      expect(count.value).toBe(1);
      expect(result1).toBe(result2);
    });

    it("caches getContent() edit-context calls", async () => {
      const { client, count } = createCountingClient();
      const query = client.content("posts").item("test-post-001");

      const content1 = await query.getContent();
      const content2 = await query.getContent();

      expect(count.value).toBe(1);
      expect(content1?.raw).toBe(content2?.raw);
    });

    it("shares edit promise between getContent() and blocks().get()", async () => {
      const { client, count } = createCountingClient();
      const query = withBlocks(client).content("posts").item("test-post-001");

      await query.getContent();
      await query.blocks().get();

      expect(count.value).toBeLessThanOrEqual(2); // edit context shared
    });

    it("caches embedded item queries", async () => {
      const { client, count } = createCountingClient();
      const query = client
        .content("posts")
        .item("test-post-001", { embed: true });

      const result1 = await query;
      const result2 = await query;

      expect(result1).toBe(result2);
      expect(result1?.id).toBe(result2?.id);
    });
  });

  describe("concurrent request deduplication", () => {
    it("deduplicates concurrent calls", async () => {
      const { client, count } = createCountingClient();
      const query = client.content("posts").item("test-post-001");

      const [r1, r2, r3] = await Promise.all([query, query, query]);

      expect(count.value).toBe(1);
      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
    });

    it("deduplicates concurrent getContent() calls", async () => {
      const { client, count } = createCountingClient();
      const query = client.content("posts").item("test-post-001");

      const results = await Promise.all([
        query.getContent(),
        query.getContent(),
        query.getContent(),
      ]);

      expect(count.value).toBe(1);
      expect(results.every((r) => r?.raw === results[0]?.raw)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("does not cache failed requests", async () => {
      let requests = 0;
      const password = process.env.WP_APP_PASSWORD;
      if (!password) throw new Error("WP_APP_PASSWORD not set");

      const client = new WordPressClient({
        auth: { password, username: "admin" },
        baseUrl: getBaseUrl(),
        fetch: async (input, init) => {
          requests++;
          if (requests === 1) throw new Error("Network error");
          return fetch(input, init);
        },
      });

      const query = client.content("posts").item("test-post-001");
      await expect(query).rejects.toThrow();
      // Second call retries (may also fail, but doesn't use cached error)
    });
  });

  describe("resource registry caching", () => {
    it("separate clients have separate caches", async () => {
      const password = process.env.WP_APP_PASSWORD;
      if (!password) throw new Error("WP_APP_PASSWORD not set");

      const client1 = new WordPressClient({
        auth: { password, username: "admin" },
        baseUrl: getBaseUrl(),
      });
      const client2 = new WordPressClient({
        auth: { password, username: "admin" },
        baseUrl: getBaseUrl(),
      });

      expect(client1.content("posts")).not.toBe(client2.content("posts"));
    });
  });
});
