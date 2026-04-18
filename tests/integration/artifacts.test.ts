import type { WordPressClient } from "fluent-wp-client";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Seed data: 3 sparse artifacts registered through the `artifact` custom post type.
 *
 * Verifies that generic content reads work correctly for sparse CPTs where
 * WordPress has disabled title, editor, excerpt, author, and comment support.
 */
describe("Client: Artifacts", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  describe("reads", () => {
    it("content() list() returns sparse artifacts without title or content fields", async () => {
      const artifacts = await publicClient.content("artifacts").list();

      expect(Array.isArray(artifacts)).toBe(true);
      expect(artifacts).toHaveLength(3);

      const first = artifacts[0];

      expect(first?.type).toBe("artifact");
      expect(first).not.toHaveProperty("title");
      expect(first).not.toHaveProperty("content");
      expect(first).not.toHaveProperty("excerpt");
      expect(first).not.toHaveProperty("author");
      expect(first).toHaveProperty("acf.acf_subtitle");
    });

    it("content() item fetches one known sparse artifact", async () => {
      const artifact = await publicClient
        .content("artifacts")
        .item("test-artifact-001");

      expect(artifact).toBeDefined();
      expect(artifact?.slug).toBe("test-artifact-001");
      expect(artifact?.type).toBe("artifact");
      expect(artifact).not.toHaveProperty("title");
      expect(artifact).not.toHaveProperty("content");
      expect(artifact).toHaveProperty(
        "acf.acf_subtitle",
        "Subtitle for test artifact 001",
      );
    });

    it("content() listAll() returns all 3 sparse artifacts", async () => {
      const all = await publicClient.content("artifacts").listAll();

      expect(all).toHaveLength(3);
      expect(all[0]).not.toHaveProperty("title");
      expect(all[0]).not.toHaveProperty("content");
    });
  });

  describe("mutations", () => {
    it("content() update() succeeds on a sparse artifact", async () => {
      const artifact = await publicClient
        .content("artifacts")
        .item("test-artifact-001");
      expect(artifact).toBeDefined();

      const updated = await authClient
        .content("artifacts")
        .update(artifact!.id, { status: "publish" });
      expect(updated.id).toBe(artifact!.id);
    });
  });
});
