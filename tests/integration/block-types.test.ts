import { beforeAll, describe, expect, it } from "vitest";
import type { WordPressBlocksClient } from "../../dist/blocks-entry.js";
import { createAuthBlocksClient } from "../helpers/wp-client";

/**
 * Integration coverage for live block type discovery.
 */
describe("Client: Block types", () => {
	let authClient: WordPressBlocksClient;

	beforeAll(() => {
		authClient = createAuthBlocksClient();
	});

	it("blocks().list() returns available block types", async () => {
		const blockTypes = await authClient.blocks().list();

		expect(Array.isArray(blockTypes)).toBe(true);
		expect(blockTypes.length).toBeGreaterThan(0);
		expect(
			blockTypes.some((blockType) => blockType.name === "core/paragraph"),
		).toBe(true);
	});

	it("blocks().list() supports namespace filtering", async () => {
		const blockTypes = await authClient.blocks().list({ namespace: "core" });

		expect(blockTypes.length).toBeGreaterThan(0);
		expect(
			blockTypes.every((blockType) => blockType.name.startsWith("core/")),
		).toBe(true);
	});

	it("blocks().item() resolves a known block type by full name", async () => {
		const paragraph = await authClient.blocks().item("core/paragraph");

		expect(paragraph).toBeDefined();
		expect(paragraph?.name).toBe("core/paragraph");
		expect(paragraph?.title.toLowerCase()).toContain("paragraph");
	});

	it("blocks().schemas() returns JSON Schemas for the available block catalog", async () => {
		const schemas = await authClient.blocks().schemas({ namespace: "core" });
		const paragraphSchema = schemas.find(
			(schema) => schema["x-wordpress-block-name"] === "core/paragraph",
		);

		expect(schemas.length).toBeGreaterThan(0);
		expect(paragraphSchema).toBeDefined();
		expect(paragraphSchema?.properties).toMatchObject({
			blockName: { const: "core/paragraph" },
		});
	});

	it("blocks().schema() returns one generated JSON Schema for a block type", async () => {
		const paragraphSchema = await authClient.blocks().schema("core/paragraph");

		expect(paragraphSchema).toBeDefined();
		expect(paragraphSchema?.["x-wordpress-block-name"]).toBe("core/paragraph");
		expect(paragraphSchema?.properties).toMatchObject({
			attrs: {
				anyOf: expect.any(Array),
			},
		});
	});
});
