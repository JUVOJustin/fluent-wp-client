import {
  getEmbeddableLinkKeys,
  getEmbeddedAuthor,
  getEmbeddedFeaturedMedia,
  getEmbeddedParent,
  getEmbeddedTerms,
  type WordPressClient,
} from "fluent-wp-client";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Integration coverage for embed-based relation fetching and extraction helpers.
 */
describe("Client: embed and relation extraction", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  describe("selective embed via embed option", () => {
    it("fetches a post with all embeds using embed: true", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: true });

      expect(post).toBeDefined();
      expect(post?.slug).toBe("test-post-001");
      expect(post?._embedded).toBeDefined();
      expect(getEmbeddedAuthor(post)).toBeDefined();
    });

    it("fetches a post with selective embed for author only", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: ["author"] });

      expect(post).toBeDefined();
      expect(post?.slug).toBe("test-post-001");
      expect(post?._embedded).toBeDefined();

      const author = getEmbeddedAuthor(post);
      expect(author).toBeDefined();
      expect(author?.slug).toBe("admin");
    });

    it("fetches a post with selective embed for terms", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: ["wp:term"] });

      expect(post).toBeDefined();
      const categories = getEmbeddedTerms(post, "category");
      expect(categories.length).toBeGreaterThan(0);

      const tags = getEmbeddedTerms(post, "post_tag");
      expect(tags.length).toBeGreaterThan(0);
    });

    it("fetches a post with multiple selective embeds", async () => {
      const post = await authClient.content("posts").item("test-post-001", {
        embed: ["author", "wp:term", "wp:featuredmedia"],
      });

      expect(post).toBeDefined();
      expect(getEmbeddedAuthor(post)).toBeDefined();
      expect(getEmbeddedTerms(post, "category").length).toBeGreaterThan(0);
    });

    it("returns no _embedded data when embed is not set", async () => {
      const post = await authClient.content("posts").item("test-post-001");

      expect(post).toBeDefined();
      // WordPress does not include _embedded when _embed is absent
      expect(post?._embedded).toBeUndefined();
    });
  });

  describe("extraction helpers", () => {
    it("getEmbeddedAuthor extracts the author from _embedded", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: ["author"] });
      const author = getEmbeddedAuthor(post);

      expect(author).toBeDefined();
      expect(author?.id).toBeTypeOf("number");
      expect(author?.slug).toBe("admin");
    });

    it("getEmbeddedTerms extracts categories", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: ["wp:term"] });
      const categories = getEmbeddedTerms(post, "category");

      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0].taxonomy).toBe("category");
    });

    it("getEmbeddedTerms extracts tags", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: ["wp:term"] });
      const tags = getEmbeddedTerms(post, "post_tag");

      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0].taxonomy).toBe("post_tag");
    });

    it("getEmbeddedTerms returns all terms when no taxonomy filter is provided", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: ["wp:term"] });
      const allTerms = getEmbeddedTerms(post);

      expect(allTerms.length).toBeGreaterThan(0);
    });

    it("getEmbeddedFeaturedMedia returns null when no featured image", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { embed: true });
      const media = getEmbeddedFeaturedMedia(post);

      // May be null if no featured image is set on this post
      expect(
        media === null || (typeof media === "object" && "id" in media),
      ).toBe(true);
    });

    it("getEmbeddedAuthor returns null on a post without _embedded", async () => {
      const post = await authClient.content("posts").item("test-post-001");
      const author = getEmbeddedAuthor(post);

      expect(author).toBeNull();
    });
  });

  describe("parent relation via embed", () => {
    it("extracts the parent page via getEmbeddedParent", async () => {
      const child = await authClient
        .content("pages")
        .item("services-web-development", { embed: ["up"] });

      expect(child).toBeDefined();
      expect(child?.parent).toBeGreaterThan(0);

      const parent = getEmbeddedParent(child);
      expect(parent).toBeDefined();
      expect(parent?.slug).toBe("services");
      expect(parent?.id).toBe(child?.parent);
    });

    it("returns null parent for top-level pages", async () => {
      const page = await authClient
        .content("pages")
        .item("about", { embed: ["up"] });

      expect(page).toBeDefined();
      expect(page?.parent).toBe(0);

      const parent = getEmbeddedParent(page);
      expect(parent).toBeNull();
    });
  });

  describe("_fields + embed interaction", () => {
    it("preserves _embedded when _fields restricts the response", async () => {
      const post = await authClient.content("posts").item("test-post-001", {
        embed: ["author"],
        fields: ["id", "title"],
      });

      expect(post).toBeDefined();
      expect(post?.id).toBeTypeOf("number");

      // _embedded should be preserved even with restricted _fields
      const author = getEmbeddedAuthor(post);
      expect(author).toBeDefined();
      expect(author?.slug).toBe("admin");
    });

    it("sends _fields correctly without embed", async () => {
      const post = await authClient.content("posts").item("test-post-001", {
        fields: ["id", "slug", "title"],
      });

      expect(post).toBeDefined();
      expect(post?.id).toBeTypeOf("number");
      expect(post?.slug).toBe("test-post-001");
      expect(post?._embedded).toBeUndefined();
    });
  });

  describe("embed on list queries", () => {
    it("returns plain array without _embedded when embed is not set", async () => {
      const posts = await publicClient.content("posts").list({ perPage: 3 });

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBe(3);
      expect(posts[0]._embedded).toBeUndefined();
    });

    it("includes _embedded when embed: true is set", async () => {
      const posts = await publicClient
        .content("posts")
        .list({ embed: true, perPage: 2 });

      expect(posts.length).toBe(2);

      for (const post of posts) {
        expect(post._embedded).toBeDefined();
        expect(getEmbeddedAuthor(post)).toBeDefined();
      }
    });

    it("supports selective embed on list queries", async () => {
      const posts = await publicClient
        .content("posts")
        .list({ embed: ["author"], perPage: 2 });

      expect(posts.length).toBe(2);

      for (const post of posts) {
        expect(post._embedded).toBeDefined();
        const author = getEmbeddedAuthor(post);
        expect(author).toBeDefined();
      }
    });
  });

  describe("relation discoverability via _links", () => {
    it("discovers embeddable link keys from a post", async () => {
      const post = await authClient
        .content("posts")
        .item("test-post-001", { fields: ["id", "_links"] });

      expect(post).toBeDefined();

      const embeddable = getEmbeddableLinkKeys(post);
      expect(embeddable).toContain("author");
      expect(embeddable).toContain("wp:term");
    });
  });
});
