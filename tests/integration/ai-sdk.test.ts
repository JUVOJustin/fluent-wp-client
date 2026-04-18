import type {
	WordPressClient,
	WordPressDiscoveryCatalog,
} from "fluent-wp-client";
import {
	createAbilityTools,
	createContentTool,
	createResourceTool,
	createTermTool,
	deleteContentTool,
	deleteResourceTool,
	executeRunAbilityTool,
	getBlocksTool,
	getContentCollectionTool,
	getContentTool,
	getResourceCollectionTool,
	getResourceTool,
	getSettingsTool,
	getTermCollectionTool,
	getTermTool,
	setBlocksTool,
	updateContentTool,
	updateResourceTool,
} from "fluent-wp-client/ai-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

async function run<T>(
	tool: { execute?: Function },
	args: Record<string, unknown>,
): Promise<T> {
	const result = await tool.execute!(args, {
		toolCallId: "test",
		messages: [],
	});
	return result as T;
}

describe("AI SDK tool integration", () => {
	let publicClient: WordPressClient;
	let authClient: WordPressClient;
	let catalog: WordPressDiscoveryCatalog;

	beforeAll(async () => {
		publicClient = createPublicClient();
		authClient = createAuthClient();
		catalog = await authClient.explore();
		publicClient.useCatalog(catalog);
	});

	describe("generic collection tools", () => {
		it("getContentCollectionTool lists posts when fixed to one content type", async () => {
			const tool = getContentCollectionTool(publicClient, {
				contentType: "posts",
				fixedArgs: { perPage: 3 },
			});

			const result = await run<unknown[]>(tool, { perPage: 10 });
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeLessThanOrEqual(3);
			expect(result[0]).toHaveProperty("id");
		});

		it("getContentCollectionTool can switch content types through input", async () => {
			const tool = getContentCollectionTool(publicClient);
			const result = await run<Array<{ slug: string }>>(tool, {
				contentType: "books",
				perPage: 2,
			});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]?.slug).toContain("test-book");
		});

		it("getTermCollectionTool lists taxonomy terms through taxonomyType", async () => {
			const tool = getTermCollectionTool(authClient);
			const result = await run<Array<{ slug: string }>>(tool, {
				taxonomyType: "categories",
				perPage: 3,
			});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toHaveProperty("slug");
		});

		it("getTermCollectionTool with fixedArgs overrides model-provided taxonomyType", async () => {
			const tool = getTermCollectionTool(authClient, {
				taxonomyType: "tags",
				fixedArgs: { taxonomyType: "tags" },
			});

			// Even if model tries to provide taxonomyType: 'categories', fixed wins
			const result = await run<Array<{ slug: string }>>(tool, { perPage: 3 });

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
			// Should return tags, not categories
			expect(result[0]).toHaveProperty("taxonomy", "post_tag");
		});

		it("getResourceCollectionTool lists users through resourceType", async () => {
			const tool = getResourceCollectionTool(authClient, {
				resourceType: "users",
			});
			const result = await run<unknown[]>(tool, { perPage: 3 });

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("generic single-item tools", () => {
		it("getContentTool fetches a post with content expansion", async () => {
			const posts = await authClient.content("posts").list({ perPage: 1 });
			const tool = getContentTool(authClient, {
				contentType: "posts",
			});

			const result = await run<{ item: { id: number }; content?: unknown }>(
				tool,
				{
					id: posts[0].id,
					includeContent: true,
				},
			);

			expect(result).toHaveProperty("item.id", posts[0].id);
			expect(result).toHaveProperty("content");
		});

		it("getContentTool with fixedArgs overrides model-provided contentType", async () => {
			const tool = getContentTool(publicClient, {
				contentType: "posts",
				fixedArgs: { contentType: "posts" },
			});

			// Even if model provides contentType: 'books', the fixed value wins
			const result = await run<{ item: { slug: string } }>(tool, {
				slug: "test-post-001",
			});

			expect(result).toHaveProperty("item.slug", "test-post-001");
		});

		it("getContentTool fetches a custom post type by slug", async () => {
			const tool = getContentTool(publicClient);
			const result = await run<{ item: { slug: string } }>(tool, {
				contentType: "books",
				slug: "test-book-001",
			});

			expect(result).toHaveProperty("item.slug", "test-book-001");
		});

		it("getTermTool fetches a term by slug", async () => {
			const tool = getTermTool(publicClient, { taxonomyType: "categories" });
			const result = await run<{ slug: string }>(tool, { slug: "technology" });

			expect(result).toHaveProperty("slug", "technology");
		});

		it("getTermTool with fixedArgs overrides model-provided taxonomyType", async () => {
			const tool = getTermTool(publicClient, {
				taxonomyType: "tags",
				fixedArgs: { taxonomyType: "tags" },
			});

			// Even if model tries to provide taxonomyType: 'categories', fixed wins
			const result = await run<{ slug: string }>(tool, { slug: "featured" });

			expect(result).toHaveProperty("slug", "featured");
		});

		it("getResourceTool fetches a user by slug", async () => {
			const user = (await authClient.users().list({ perPage: 1 }))[0];
			const tool = getResourceTool(authClient, { resourceType: "users" });
			const result = await run<{ slug: string }>(tool, { slug: user.slug });

			expect(result).toHaveProperty("slug", user.slug);
		});

		it("getResourceTool with fixedArgs overrides model-provided resourceType", async () => {
			const user = (await authClient.users().list({ perPage: 1 }))[0];
			const tool = getResourceTool(authClient, {
				resourceType: "users",
				fixedArgs: { resourceType: "users" },
			});

			// Even if model tries to provide resourceType: 'media', fixed wins
			const result = await run<{ slug: string }>(tool, { slug: user.slug });

			expect(result).toHaveProperty("slug", user.slug);
		});

		it("getSettingsTool returns site settings", async () => {
			const tool = getSettingsTool(authClient);
			const result = await run<{ title: string }>(tool, {});

			expect(result).toHaveProperty("title");
		});
	});

	describe("generic mutation tools", () => {
		const postCleanupIds: number[] = [];
		const userCleanupIds: number[] = [];

		afterAll(async () => {
			for (const id of postCleanupIds) {
				try {
					await authClient.content("posts").delete(id, { force: true });
				} catch {}
			}

			for (const id of userCleanupIds) {
				try {
					await authClient.users().delete(id, { force: true, reassign: 1 });
				} catch {}
			}
		});

		it("createContentTool creates a draft post", async () => {
			const tool = createContentTool(authClient, {
				contentType: "posts",
				fixedInput: { status: "draft" },
			});

			const result = await run<{ id: number }>(tool, {
				input: {
					title: "AI SDK Generic Post",
					content: "Created via generic content tool",
				},
			});

			expect(result).toHaveProperty("id");
			postCleanupIds.push(result.id);
		});

		it("updateContentTool updates a post", async () => {
			const created = await authClient
				.content("posts")
				.create({ title: "Update Target", status: "draft" });
			postCleanupIds.push(created.id);

			const tool = updateContentTool(authClient, { contentType: "posts" });
			const result = await run<{ id: number }>(tool, {
				id: created.id,
				input: { title: "Updated Generic Title" },
			});

			expect(result).toHaveProperty("id", created.id);
		});

		it("deleteContentTool deletes a post", async () => {
			const created = await authClient
				.content("posts")
				.create({ title: "Delete Target", status: "draft" });
			const tool = deleteContentTool(authClient, { contentType: "posts" });
			const result = await run<{ deleted: boolean }>(tool, {
				id: created.id,
				force: true,
			});

			expect(result).toHaveProperty("deleted", true);
		});

		it("createResourceTool creates a user", async () => {
			const tool = createResourceTool(authClient, { resourceType: "users" });
			const unique = Date.now();
			const result = await run<{ id: number }>(tool, {
				input: {
					username: `ai-sdk-user-${unique}`,
					email: `ai-sdk-user-${unique}@example.com`,
					password: "password123!",
					name: "AI SDK User",
				},
			});

			expect(result).toHaveProperty("id");
			userCleanupIds.push(result.id);
		});

		it("updateResourceTool updates a user", async () => {
			const unique = Date.now();
			const created = await authClient.users().create({
				username: `ai-sdk-update-${unique}`,
				email: `ai-sdk-update-${unique}@example.com`,
				password: "password123!",
			});
			userCleanupIds.push(created.id);

			const tool = updateResourceTool(authClient, { resourceType: "users" });
			const result = await run<{ id: number }>(tool, {
				id: created.id,
				input: { name: "Updated AI SDK User" },
			});

			expect(result).toHaveProperty("id", created.id);
		});

		it("deleteResourceTool deletes a user", async () => {
			const unique = Date.now();
			const created = await authClient.users().create({
				username: `ai-sdk-delete-${unique}`,
				email: `ai-sdk-delete-${unique}@example.com`,
				password: "password123!",
			});

			const tool = deleteResourceTool(authClient, { resourceType: "users" });
			const result = await run<{ deleted: boolean }>(tool, {
				id: created.id,
				force: true,
				reassign: 1,
			});

			expect(result).toHaveProperty("deleted", true);
		});

		it("returns structured tool errors instead of throwing raw exceptions", async () => {
			const tool = createContentTool(publicClient, { contentType: "posts" });
			const result = await run<{
				ok: false;
				error: { kind: string; message: string; status?: number };
			}>(tool, {
				input: { title: "Unauthorized post" },
			});

			expect(result).toHaveProperty("ok", false);
			expect(result).toHaveProperty("error.kind");
			expect(result).toHaveProperty("error.message");
		});
	});

	describe("catalog-aware schemas", () => {
		it("content tools expose catalog-backed contentType enums", () => {
			const tool = getContentCollectionTool(publicClient);
			const schema = tool.inputSchema as {
				safeParse: (input: unknown) => { success: boolean };
			};

			expect(schema.safeParse({ contentType: "posts" }).success).toBe(true);
			expect(schema.safeParse({ contentType: "not-a-real-type" }).success).toBe(
				false,
			);
		});

		it("fixed content tools remove contentType from the input shape", () => {
			const tool = createContentTool(authClient, { contentType: "posts" });
			const schema = tool.inputSchema as {
				safeParse: (input: unknown) => { success: boolean };
			};

			expect(
				schema.safeParse({
					contentType: "posts",
					input: { title: "Hello world" },
				}).success,
			).toBe(false);
		});

		it("ability tools expose catalog-backed ability enums when available", () => {
			const abilityNames = Object.keys(catalog.abilities);
			if (abilityNames.length === 0) return;

			const tool = executeRunAbilityTool(authClient);
			const schema = tool.inputSchema as {
				safeParse: (input: unknown) => { success: boolean };
			};

			expect(schema.safeParse({ name: abilityNames[0] }).success).toBe(true);
			expect(schema.safeParse({ name: "missing/ability" }).success).toBe(false);
		});

		it("manual inputSchema overrides generated schemas when no catalog is provided", () => {
			const tool = createContentTool(authClient, {
				contentType: "posts",
				inputSchema: z.object({
					input: z.object({
						title: z.string(),
						customField: z.number(),
					}),
				}),
			});
			const schema = tool.inputSchema as {
				safeParse: (input: unknown) => { success: boolean };
			};

			expect(
				schema.safeParse({ input: { title: "Hello", customField: 1 } }).success,
			).toBe(true);
			expect(schema.safeParse({ input: { title: "Hello" } }).success).toBe(
				false,
			);
		});
	});

	describe("block tools", () => {
		let blockTestPostId: number;

		beforeAll(async () => {
			const post = await authClient.content("posts").create({
				title: "Block Tool Test Post",
				content:
					"<!-- wp:paragraph -->\n<p>Original content</p>\n<!-- /wp:paragraph -->",
				status: "draft",
			});
			blockTestPostId = post.id;
		});

		afterAll(async () => {
			if (blockTestPostId) {
				try {
					await authClient
						.content("posts")
						.delete(blockTestPostId, { force: true });
				} catch {}
			}
		});

		it("getBlocksTool returns parsed block structure", async () => {
			const tool = getBlocksTool(authClient, { contentType: "posts" });
			const result = await run<{
				id: number;
				contentType: string;
				blocks: unknown[];
			}>(tool, {
				id: blockTestPostId,
			});

			expect(result).toHaveProperty("id", blockTestPostId);
			expect(result).toHaveProperty("contentType", "posts");
			expect(Array.isArray(result.blocks)).toBe(true);
			expect(result.blocks.length).toBeGreaterThan(0);
		});

		it("setBlocksTool writes block structure and getBlocksTool reads it back", async () => {
			const newBlocks = [
				{
					blockName: "core/paragraph",
					attrs: {},
					innerBlocks: [],
					innerHTML: "\n<p>Updated via AI SDK tool</p>\n",
					innerContent: ["\n<p>Updated via AI SDK tool</p>\n"],
				},
				{
					blockName: "core/heading",
					attrs: { level: 2 },
					innerBlocks: [],
					innerHTML: "\n<h2>AI-generated heading</h2>\n",
					innerContent: ["\n<h2>AI-generated heading</h2>\n"],
				},
			];

			const setTool = setBlocksTool(authClient, { contentType: "posts" });
			const setResult = await run<{ updated: boolean }>(setTool, {
				id: blockTestPostId,
				blocks: newBlocks,
			});
			expect(setResult).toHaveProperty("updated", true);

			const getTool = getBlocksTool(authClient, { contentType: "posts" });
			const getResult = await run<{ blocks: Array<{ blockName: string }> }>(
				getTool,
				{
					id: blockTestPostId,
				},
			);

			const blockNames = getResult.blocks
				.filter((b) => b.blockName)
				.map((b) => b.blockName);
			expect(blockNames).toContain("core/paragraph");
			expect(blockNames).toContain("core/heading");
		});

		it("getBlocksTool with fixedArgs overrides model-provided contentType", async () => {
			const tool = getBlocksTool(authClient, {
				contentType: "posts",
				fixedArgs: { contentType: "posts" },
			});

			// Even if model tries to provide contentType: 'pages', fixed wins
			const result = await run<{ id: number; contentType: string }>(tool, {
				id: blockTestPostId,
			});

			expect(result).toHaveProperty("id", blockTestPostId);
			expect(result).toHaveProperty("contentType", "posts");
		});

		it("setBlocksTool with fixedArgs overrides model-provided contentType", async () => {
			const newBlocks = [
				{
					blockName: "core/paragraph",
					attrs: {},
					innerBlocks: [],
					innerHTML: "\n<p>FixedArgs test content</p>\n",
					innerContent: ["\n<p>FixedArgs test content</p>\n"],
				},
			];

			const tool = setBlocksTool(authClient, {
				contentType: "posts",
				fixedArgs: { contentType: "posts" },
			});

			// Even if model tries to provide contentType: 'pages', fixed wins
			const result = await run<{ updated: boolean }>(tool, {
				id: blockTestPostId,
				blocks: newBlocks,
			});

			expect(result).toHaveProperty("updated", true);
		});
	});

	describe("createAbilityTools", () => {
		const optionKey = "ai_sdk_ability_tools_test";

		afterAll(async () => {
			await authClient
				.executeDeleteAbility("test/delete-option", optionKey)
				.catch(() => undefined);
		});

		it("throws when no catalog is available", () => {
			const freshClient = createPublicClient();

			expect(() => createAbilityTools(freshClient)).toThrow(
				"requires a discovery catalog",
			);
		});

		it("generates one tool per discovered ability from the cached catalog", () => {
			const abilityNames = Object.keys(catalog.abilities);
			if (abilityNames.length === 0) return;

			const tools = createAbilityTools(authClient);

			expect(Object.keys(tools).length).toBe(abilityNames.length);

			// Tool keys replace / with _
			for (const name of abilityNames) {
				expect(tools).toHaveProperty(name.replace("/", "_"));
			}
		});

		it("include filters to only the specified abilities", () => {
			const tools = createAbilityTools(authClient, {
				include: ["test/get-site-title"],
			});

			expect(Object.keys(tools)).toEqual(["test_get-site-title"]);
		});

		it("exclude removes specified abilities", () => {
			const all = createAbilityTools(authClient);
			const filtered = createAbilityTools(authClient, {
				exclude: ["test/get-site-title"],
			});

			expect(Object.keys(filtered).length).toBe(Object.keys(all).length - 1);
			expect(filtered).not.toHaveProperty("test_get-site-title");
		});

		it("toolName overrides the generated tool key", () => {
			const tools = createAbilityTools(authClient, {
				include: ["test/get-site-title"],
				toolName: (name) => `wp_${name.replace("/", "__")}`,
			});

			expect(Object.keys(tools)).toEqual(["wp_test__get-site-title"]);
		});

		it("toolDescription overrides the generated tool description", () => {
			const tools = createAbilityTools(authClient, {
				include: ["test/get-site-title"],
				toolDescription: () => "Custom description",
			});

			const toolDef = tools["test_get-site-title"] as { description?: string };
			expect(toolDef.description).toBe("Custom description");
		});

		it("executes a readonly ability via GET", async () => {
			const tools = createAbilityTools(authClient, {
				include: ["test/get-site-title"],
			});

			const result = await run<{ title: string }>(
				tools["test_get-site-title"],
				{},
			);

			expect(typeof result.title).toBe("string");
			expect(result.title.length).toBeGreaterThan(0);
		});

		it("executes a regular ability via POST with typed input", async () => {
			const tools = createAbilityTools(authClient, {
				include: ["test/update-option"],
			});

			const result = await run<{ previous: string; current: string }>(
				tools["test_update-option"],
				{ input: { key: optionKey, value: "ability-tools-test" } },
			);

			expect(result.current).toBe("ability-tools-test");
		});

		it("executes a destructive ability via DELETE", async () => {
			// Seed the option first
			await authClient.executeRunAbility("test/update-option", {
				key: optionKey,
				value: "delete-me",
			});

			const tools = createAbilityTools(authClient, {
				include: ["test/delete-option"],
			});

			const result = await run<{ deleted: boolean; previous: string }>(
				tools["test_delete-option"],
				{ input: optionKey },
			);

			expect(result.deleted).toBe(true);
			expect(result.previous).toBe("delete-me");
		});

		it("returns structured error envelopes on failure", async () => {
			const publicTools = createAbilityTools(publicClient, {
				include: ["test/get-site-title"],
			});

			const result = await run<{
				ok: false;
				error: { kind: string; message: string; status?: number };
			}>(publicTools["test_get-site-title"], {});

			expect(result).toHaveProperty("ok", false);
			expect(result).toHaveProperty("error.kind");
		});

		it("accepts an explicit catalog instead of the cached one", () => {
			const freshClient = createPublicClient();
			const tools = createAbilityTools(freshClient, { catalog });

			expect(Object.keys(tools).length).toBe(
				Object.keys(catalog.abilities).length,
			);
		});
	});
});
