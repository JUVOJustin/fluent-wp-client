import type { WordPressClient } from "fluent-wp-client";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Integration coverage for the fluent settings singleton client.
 */
describe("Client: Settings", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;

  beforeAll(() => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
  });

  it("settings().get returns site settings when authenticated", async () => {
    const settings = await authClient.settings().get();

    expect(settings).toHaveProperty("title");
    expect(settings).toHaveProperty("description");
    expect(settings).toHaveProperty("url");
    expect(settings).toHaveProperty("timezone");
    expect(settings).toHaveProperty("language");
    expect(settings).toHaveProperty("posts_per_page");
    expect(typeof settings.posts_per_page).toBe("number");
  });

  it("settings().describe returns schema metadata", async () => {
    const description = await authClient.settings().describe();

    expect(description.kind).toBe("resource");
    expect(description.resource).toBe("settings");
    expect(description.route).toBe("/wp-json/wp/v2/settings");
    expect(description.schemas.item).toBeDefined();
  });

  it("settings().update updates and restores the site title", async () => {
    const original = await authClient.settings().get();
    const temporaryTitle = `Fluent WP Client Settings ${Date.now()}`;

    try {
      const updated = await authClient
        .settings()
        .update({ title: temporaryTitle });
      expect(updated.title).toBe(temporaryTitle);
    } finally {
      await authClient.settings().update({ title: original.title });
    }
  });

  it("settings().get throws without auth", async () => {
    await expect(publicClient.settings().get()).rejects.toThrow(
      "Authentication required",
    );
  });
});
