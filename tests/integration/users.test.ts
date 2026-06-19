import { randomUUID } from "node:crypto";
import { createJwtAuthHeader, WordPressClient } from "fluent-wp-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAuthClient,
  createJwtAuthClient,
  createPublicClient,
} from "../helpers/wp-client";

/**
 * Integration coverage for the fluent users client across public and authenticated flows.
 */
describe("Client: Users", () => {
  let publicClient: WordPressClient;
  let authClient: WordPressClient;
  let jwtClient: WordPressClient;
  let requestSignedClient: WordPressClient;
  let reassignUserId = 1;
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    publicClient = createPublicClient();
    authClient = createAuthClient();
    jwtClient = createJwtAuthClient();
    requestSignedClient = new WordPressClient({
      authHeaders: ({ method, url }) => {
        if (method !== "GET") {
          throw new Error("Expected GET for users endpoint test.");
        }

        if (!url.pathname.endsWith("/wp-json/wp/v2/users/me")) {
          throw new Error(
            "Expected /users/me endpoint for auth header provider test.",
          );
        }

        return {
          Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
        };
      },
      baseUrl: process.env.WP_BASE_URL!,
    });

    reassignUserId = (await authClient.users().me()).id;
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await authClient
        .users()
        .delete(id, { force: true, reassign: reassignUserId })
        .catch(() => undefined);
    }
  });

  it("users().list returns an array of users", async () => {
    const users = await publicClient.users().list();

    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
  });

  it("every listed user has required fields", async () => {
    const users = await publicClient.users().list();

    for (const user of users) {
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("slug");
      expect(user).toHaveProperty("link");
      expect(user).toHaveProperty("avatar_urls");
    }
  });

  it("users().item fetches a single user by ID", async () => {
    const users = await publicClient.users().list();
    const user = await publicClient.users().item(users[0].id);

    if (!user) {
      throw new Error("Expected seeded admin user to exist.");
    }

    expect(user.id).toBe(users[0].id);
    expect(user.slug).toBe("admin");
  });

  it("users().listAll auto-paginates", async () => {
    const all = await publicClient.users().listAll();

    expect(all).toHaveLength(1);
  });

  it("users().listPaginated returns pagination metadata", async () => {
    const result = await publicClient
      .users()
      .listPaginated({ page: 1, perPage: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("users().describe returns schema metadata", async () => {
    const description = await authClient.users().describe();

    expect(description.kind).toBe("resource");
    expect(description.resource).toBe("users");
    expect(description.route).toBe("/wp-json/wp/v2/users");
    expect(description.schemas.item).toBeDefined();
    expect(description.schemas.collection).toBeDefined();
  });

  it("users().me returns the authenticated admin user", async () => {
    const me = await authClient.users().me();

    expect(me).toHaveProperty("id");
    expect(me.slug).toBe("admin");
  });

  it("users().me also works with JWT auth config", async () => {
    const me = await jwtClient.users().me();

    expect(me).toHaveProperty("id");
    expect(me.slug).toBe("admin");
  });

  it("users().me also works with a request-aware auth header provider", async () => {
    const me = await requestSignedClient.users().me();

    expect(me).toHaveProperty("id");
    expect(me.slug).toBe("admin");
  });

  it("request also supports same-origin absolute URLs", async () => {
    const endpoint = new URL(
      "/wp-json/wp/v2/users/me",
      process.env.WP_BASE_URL!,
    ).toString();
    const { data, response } = await jwtClient.request<{ slug: string }>({
      endpoint,
    });

    expect(response.ok).toBe(true);
    expect(data.slug).toBe("admin");
  });

  it("request rejects cross-origin absolute URLs before forwarding auth", async () => {
    const endpoint = new URL(
      "/wp-json/wp/v2/users/me",
      process.env.WP_BASE_URL!,
    );
    endpoint.hostname =
      endpoint.hostname === "localhost" ? "127.0.0.1" : "localhost";

    await expect(
      authClient.request({ endpoint: endpoint.toString() }),
    ).rejects.toThrow("Cross-origin absolute URLs are not allowed");
  });

  it("users().create, update, and delete supports full CRUD", async () => {
    const unique = Date.now();
    const created = await authClient.users().create({
      email: `client-user-${unique}@example.com`,
      password: "securepass123!",
      roles: ["author"],
      username: `client-user-${unique}`,
    });

    createdUserIds.push(created.id);

    expect(created.id).toBeGreaterThan(0);
    expect(created.slug).toContain(`client-user-${unique}`);

    const updated = await authClient.users().update(created.id, {
      first_name: "Client",
      last_name: "User",
    });

    expect(updated.first_name).toBe("Client");
    expect(updated.last_name).toBe("User");

    const deleted = await authClient.users().delete(created.id, {
      force: true,
      reassign: reassignUserId,
    });

    expect(deleted.deleted).toBe(true);
  });

  it("users().applicationPasswords manages passwords for a user", async () => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const managedUser = await authClient.users().create({
      email: `client-app-password-user-${unique}@example.com`,
      password: "securepass123!",
      roles: ["author"],
      username: `client-app-password-user-${unique}`,
    });
    createdUserIds.push(managedUser.id);

    const passwords = authClient.users().applicationPasswords(managedUser.id);
    const created = await passwords.create({
      app_id: randomUUID(),
      name: `client-app-${unique}`,
    });

    expect(created.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(created.name).toBe(`client-app-${unique}`);
    expect(created.password).toBeTypeOf("string");

    const listed = await passwords.list({ context: "edit" });
    expect(listed.map((password) => password.uuid)).toContain(created.uuid);

    const fetched = await passwords.get(created.uuid, { context: "edit" });
    expect(fetched.uuid).toBe(created.uuid);
    expect(fetched.app_id).toBe(created.app_id);

    const updatedAppId = randomUUID();
    const updated = await passwords.update(created.uuid, {
      app_id: updatedAppId,
      name: `client-app-renamed-${unique}`,
    });
    expect(updated.uuid).toBe(created.uuid);
    // Core accepts app_id on update requests but keeps the original app_id.
    expect(updated.app_id).toBe(created.app_id);
    expect(updated.name).toBe(`client-app-renamed-${unique}`);

    const deleted = await passwords.delete(created.uuid);
    expect(deleted.deleted).toBe(true);
    expect(deleted.uuid).toBe(created.uuid);
    expect(deleted.previous?.uuid).toBe(created.uuid);

    const first = await passwords.create({
      name: `client-app-delete-all-a-${unique}`,
    });
    const second = await passwords.create({
      name: `client-app-delete-all-b-${unique}`,
    });

    const deleteAll = await passwords.deleteAll();
    expect(deleteAll.deleted).toBe(true);
    expect(deleteAll.count).toBe(2);

    const remaining = await passwords.list();
    expect(remaining.map((password) => password.uuid)).not.toContain(
      first.uuid,
    );
    expect(remaining.map((password) => password.uuid)).not.toContain(
      second.uuid,
    );
    expect(remaining).toHaveLength(0);
  });

  it("users().applicationPasswords('me').introspect returns the current application password", async () => {
    const current = await authClient
      .users()
      .applicationPasswords("me")
      .introspect({ context: "edit" });

    expect(current.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(current.name).toBe("vitest");
  });

  it("users().me throws without auth", async () => {
    await expect(publicClient.users().me()).rejects.toThrow(
      "Authentication required",
    );
  });
});
