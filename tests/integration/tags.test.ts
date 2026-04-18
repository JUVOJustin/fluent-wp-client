import type { WordPressClient } from "fluent-wp-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Seed data: 8 tags (featured, trending, tutorial, review, guide, news, opinion, update).
 */
describe("Client: Tags", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let seededTagIds: number[] = [];
  const createdTagIds: number[] = [];

  function tagsClient(client: WordPressClient) {
    return client.terms("tags");
  }

  beforeAll(async () => {
    publicClient = createPublicClient();
    authClient = createAuthClient();

    const seedSlugs = [
      "featured",
      "trending",
      "tutorial",
      "review",
      "guide",
      "news",
      "opinion",
      "update",
    ];
    const seedTags = await Promise.all(
      seedSlugs.map((slug) => tagsClient(publicClient).item(slug)),
    );

    seededTagIds = seedTags
      .map((tag) => tag?.id)
      .filter((id): id is number => typeof id === "number");
  });

  afterAll(async () => {
    for (const id of createdTagIds) {
      await tagsClient(authClient)
        .delete(id, { force: true })
        .catch(() => undefined);
    }
  });

  describe("reads", () => {
    it("terms('tags').list() returns an array", async () => {
      const tags = await tagsClient(publicClient).list();

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
    });

    it("every tag has required fields", async () => {
      const tags = await tagsClient(publicClient).list();

      for (const tag of tags) {
        expect(tag).toHaveProperty("id");
        expect(tag).toHaveProperty("name");
        expect(tag).toHaveProperty("slug");
        expect(tag).toHaveProperty("count");
        expect(tag).toHaveProperty("taxonomy");
        expect(tag.taxonomy).toBe("post_tag");
      }
    });

    it("terms('tags').item() fetches a known seed tag", async () => {
      const tag = await tagsClient(publicClient).item("featured");

      expect(tag).toBeDefined();
      expect(tag?.slug).toBe("featured");
      expect(tag?.name).toBe("Featured");
      expect(tag?.count).toBe(60);
    });

    it("terms('tags').item() returns undefined for non-existent slug", async () => {
      const tag = await tagsClient(publicClient).item("nonexistent-tag-999");

      expect(tag).toBeUndefined();
    });

    it("terms('tags').listAll() returns all 8 tags", async () => {
      const all = await tagsClient(publicClient).listAll({
        include: seededTagIds,
      });

      expect(all).toHaveLength(8);

      const slugs = all.map((t) => t.slug).sort();
      expect(slugs).toEqual([
        "featured",
        "guide",
        "news",
        "opinion",
        "review",
        "trending",
        "tutorial",
        "update",
      ]);
    });

    it("terms('tags').listPaginated() returns pagination metadata", async () => {
      const result = await tagsClient(publicClient).listPaginated({
        include: seededTagIds,
        page: 1,
        perPage: 3,
      });

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(8);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(1);
    });
  });

  describe("crud", () => {
    it("creates, updates, and deletes tags", async () => {
      const created = await tagsClient(authClient).create({
        description: "Tag created by integration tests.",
        name: "client-crud-tag",
      });

      createdTagIds.push(created.id);

      expect(created.name).toBe("client-crud-tag");
      expect(created.taxonomy).toBe("post_tag");

      const updated = await tagsClient(authClient).update(created.id, {
        name: "client-crud-tag-updated",
      });

      expect(updated.name).toBe("client-crud-tag-updated");

      const deleted = await tagsClient(authClient).delete(created.id, {
        force: true,
      });
      expect(deleted.deleted).toBe(true);
    });

    it("throws for unauthenticated tag creation", async () => {
      await expect(
        tagsClient(publicClient).create({
          name: "client-crud-public-tag",
        }),
      ).rejects.toMatchObject({
        name: "WordPressHttpError",
      });
    });

    it("throws for a non-existent tag on update", async () => {
      await expect(
        tagsClient(authClient).update(999999, { name: "Ghost Tag" }),
      ).rejects.toMatchObject({
        name: "WordPressHttpError",
        status: 404,
      });
    });
  });
});
