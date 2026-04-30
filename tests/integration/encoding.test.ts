import {
  normalizeWordPressResponse,
  normalizeWordPressString,
  type WordPressClient,
  type WordPressPostWriteBase,
} from "fluent-wp-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Tests that double-encoded HTML entities from WordPress REST API responses
 * are normalized to single-encoded entities.
 *
 * WordPress occasionally double-escapes `&`, `<`, `>`, `"`, etc. in rendered
 * fields (title.rendered, content.rendered, excerpt.rendered). The client
 * normalizes these centrally in the transport layer.
 */
describe("Client: Encoding normalization", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  const createdPostIds: number[] = [];

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  afterAll(async () => {
    for (const id of createdPostIds) {
      await authClient
        .content("posts")
        .delete(id, { force: true })
        .catch(() => undefined);
    }
  });

  describe("normalizeWordPressString", () => {
    it("fixes double-encoded ampersand", () => {
      expect(normalizeWordPressString("A &amp;amp; B")).toBe("A &amp; B");
    });

    it("fixes double-encoded less-than", () => {
      expect(normalizeWordPressString("5 &amp;lt; 10")).toBe("5 &lt; 10");
    });

    it("fixes double-encoded greater-than", () => {
      expect(normalizeWordPressString("10 &amp;gt; 5")).toBe("10 &gt; 5");
    });

    it("fixes double-encoded quote", () => {
      expect(normalizeWordPressString("Say &amp;quot;hello&amp;quot;")).toBe(
        "Say &quot;hello&quot;",
      );
    });

    it("fixes double-encoded apostrophe", () => {
      expect(normalizeWordPressString("It&amp;apos;s fine")).toBe(
        "It&apos;s fine",
      );
    });

    it("fixes double-encoded numeric entities", () => {
      expect(normalizeWordPressString("&amp;#39;")).toBe("&#39;");
      expect(normalizeWordPressString("&amp;#x3C;")).toBe("&#x3C;");
    });

    it("does not touch single-encoded entities", () => {
      expect(normalizeWordPressString("A &amp; B")).toBe("A &amp; B");
      expect(normalizeWordPressString("5 &lt; 10")).toBe("5 &lt; 10");
      expect(normalizeWordPressString("Say &quot;hello&quot;")).toBe(
        "Say &quot;hello&quot;",
      );
    });

    it("does not touch plain text without entities", () => {
      expect(normalizeWordPressString("Hello World")).toBe("Hello World");
      expect(normalizeWordPressString("Middle East & North Africa")).toBe(
        "Middle East & North Africa",
      );
    });

    it("handles multiple double-encoded entities in one string", () => {
      expect(
        normalizeWordPressString(
          "A &amp;amp; B &amp;lt; C &amp;gt; D &amp;quot;E&amp;quot;",
        ),
      ).toBe("A &amp; B &lt; C &gt; D &quot;E&quot;");
    });
  });

  describe("normalizeWordPressResponse", () => {
    it("normalizes strings at .rendered paths inside nested objects", () => {
      const input = {
        excerpt: { rendered: "5 &amp;lt; 10" },
        title: { rendered: "A &amp;amp; B" },
      };
      const result = normalizeWordPressResponse(input);

      expect(result.title.rendered).toBe("A &amp; B");
      expect(result.excerpt.rendered).toBe("5 &lt; 10");
    });

    it("normalizes strings at .rendered paths inside arrays", () => {
      const input = [
        { title: { rendered: "A &amp;amp; B" } },
        { title: { rendered: "C &amp;lt; D" } },
      ];
      const result = normalizeWordPressResponse(input);

      expect(result[0].title.rendered).toBe("A &amp; B");
      expect(result[1].title.rendered).toBe("C &lt; D");
    });

    it("leaves numbers and booleans untouched", () => {
      const input = {
        count: 42,
        flag: true,
        title: { rendered: "A &amp;amp; B" },
      };
      const result = normalizeWordPressResponse(input);

      expect(result.count).toBe(42);
      expect(result.flag).toBe(true);
      expect(result.title.rendered).toBe("A &amp; B");
    });

    it("mutates the input object in place", () => {
      const input = { title: { rendered: "A &amp;amp; B" } };
      const result = normalizeWordPressResponse(input);

      expect(result).toBe(input);
      expect(input.title.rendered).toBe("A &amp; B");
    });

    it("does not normalize strings outside .rendered paths", () => {
      const input = {
        name: "Q&amp;A", // term name — not a .rendered path, left as-is
        slug: "q&amp;a", // slug — left as-is
        title: { rendered: "A &amp;amp; B" },
      };
      const result = normalizeWordPressResponse(input);

      expect(result.slug).toBe("q&amp;a");
      expect(result.name).toBe("Q&amp;A");
      expect(result.title.rendered).toBe("A &amp; B");
    });

    it("does not normalize plain string values at the root", () => {
      const input = "A &amp;amp; B";
      const result = normalizeWordPressResponse(input);

      expect(result).toBe("A &amp;amp; B");
    });
  });

  describe("seed data encoding test post", () => {
    it("returns properly normalized title from list endpoint", async () => {
      const posts = await publicClient.content("posts").list({
        slug: "encoding-test-post",
      });

      expect(posts.length).toBe(1);
      const post = posts[0];

      // WordPress may use numeric or named entities; the key invariant is
      // that no *double*-encoded patterns remain.
      expect(post.title.rendered).not.toContain("&amp;amp;");
      expect(post.title.rendered).not.toContain("&amp;lt;");
      expect(post.title.rendered).not.toContain("&amp;gt;");
      expect(post.title.rendered).not.toContain("&amp;quot;");

      // Verify the title contains expected characters (via any valid entity form)
      const hasAmpersand =
        post.title.rendered.includes("&amp;") ||
        post.title.rendered.includes("&#038;");
      expect(hasAmpersand).toBe(true);
    });

    it("returns properly normalized excerpt from list endpoint", async () => {
      const posts = await publicClient.content("posts").list({
        slug: "encoding-test-post",
      });

      expect(posts.length).toBe(1);
      const post = posts[0];

      expect(post.excerpt?.rendered).not.toContain("&amp;amp;");
      expect(post.excerpt?.rendered).not.toContain("&amp;lt;");
      expect(post.excerpt?.rendered).not.toContain("&amp;gt;");
    });

    it("returns properly normalized title from item endpoint", async () => {
      const post = await publicClient
        .content("posts")
        .item("encoding-test-post");

      expect(post).toBeDefined();
      expect(post?.title.rendered).not.toContain("&amp;amp;");
      expect(post?.title.rendered).not.toContain("&amp;lt;");
      expect(post?.title.rendered).not.toContain("&amp;gt;");
    });
  });

  describe("dynamic CRUD with special characters", () => {
    it("creates and reads back a post with special characters", async () => {
      const title = "Test: A & B, 5 < 10, 10 > 5";
      const content =
        "<p>Testing \"quotes\" and 'apostrophes' with &amp; ampersand.</p>";
      const excerpt = "Excerpt with &amp; and <tags>";

      const created = await authClient.content("posts").create({
        content,
        excerpt,
        status: "publish",
        title,
      } as WordPressPostWriteBase);

      createdPostIds.push(created.id);

      const fetched = await publicClient.content("posts").item(created.id);

      expect(fetched).toBeDefined();
      // WordPress stores raw content; rendered may have single-encoded entities.
      // The client normalizes any double-encoded ones.
      expect(fetched?.title.rendered).not.toContain("&amp;amp;");
      expect(fetched?.content.rendered).not.toContain("&amp;amp;");
      expect(fetched?.excerpt?.rendered).not.toContain("&amp;amp;");
    });

    it("updates a post with special characters and reads it back", async () => {
      const created = await authClient.content("posts").create({
        status: "publish",
        title: "Initial Title",
      } as WordPressPostWriteBase);

      createdPostIds.push(created.id);

      const updated = await authClient.content("posts").update(created.id, {
        title: "Updated: Research &amp; Development",
      } as WordPressPostWriteBase);

      expect(updated.title.rendered).not.toContain("&amp;amp;");
    });
  });

  describe("edge cases", () => {
    it("handles content without any entities gracefully", async () => {
      const created = await authClient.content("posts").create({
        status: "publish",
        title: "Plain Title Without Entities",
      } as WordPressPostWriteBase);

      createdPostIds.push(created.id);

      const fetched = await publicClient.content("posts").item(created.id);

      expect(fetched).toBeDefined();
      expect(fetched?.title.rendered).toBe("Plain Title Without Entities");
    });
  });
});
