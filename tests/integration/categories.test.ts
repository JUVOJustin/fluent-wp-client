import type { WordPressClient } from "fluent-wp-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Seed data: 5 custom categories (Technology, Science, Travel, Food, Health)
 * plus the default "Uncategorized" = 6 total.
 */
describe("Client: Categories", () => {
	let publicClient: WordPressClient;
	let authClient: WordPressClient;
	let seededCategoryIds: number[] = [];
	const createdCategoryIds: number[] = [];

	function categoriesClient(client: WordPressClient) {
		return client.terms("categories");
	}

	beforeAll(async () => {
		publicClient = createPublicClient();
		authClient = createAuthClient();

		const seedSlugs = [
			"technology",
			"science",
			"travel",
			"food",
			"health",
			"uncategorized",
		];
		const seedCategories = await Promise.all(
			seedSlugs.map((slug) => categoriesClient(publicClient).item(slug)),
		);

		seededCategoryIds = seedCategories
			.map((category) => category?.id)
			.filter((id): id is number => typeof id === "number");
	});

	afterAll(async () => {
		for (const id of createdCategoryIds) {
			await categoriesClient(authClient)
				.delete(id, { force: true })
				.catch(() => undefined);
		}
	});

	describe("reads", () => {
		it("terms('categories').list() returns an array", async () => {
			const categories = await categoriesClient(publicClient).list();

			expect(Array.isArray(categories)).toBe(true);
			expect(categories.length).toBeGreaterThan(0);
		});

		it("every category has required fields", async () => {
			const categories = await categoriesClient(publicClient).list();

			for (const cat of categories) {
				expect(cat).toHaveProperty("id");
				expect(cat).toHaveProperty("name");
				expect(cat).toHaveProperty("slug");
				expect(cat).toHaveProperty("count");
				expect(cat).toHaveProperty("taxonomy");
				expect(cat.taxonomy).toBe("category");
			}
		});

		it("terms('categories').item() fetches a known seed category", async () => {
			const category = await categoriesClient(publicClient).item("technology");

			expect(category).toBeDefined();
			expect(category!.slug).toBe("technology");
			expect(category!.name).toBe("Technology");
			expect(category!.count).toBe(30);
		});

		it("terms('categories').item() returns undefined for non-existent slug", async () => {
			const category = await categoriesClient(publicClient).item(
				"nonexistent-cat-999",
			);

			expect(category).toBeUndefined();
		});

		it("terms('categories').listAll() returns all 6 categories", async () => {
			const all = await categoriesClient(publicClient).listAll({
				include: seededCategoryIds,
			});

			expect(all).toHaveLength(6);

			const slugs = all.map((c) => c.slug).sort();
			expect(slugs).toContain("technology");
			expect(slugs).toContain("science");
			expect(slugs).toContain("travel");
			expect(slugs).toContain("food");
			expect(slugs).toContain("health");
			expect(slugs).toContain("uncategorized");
		});

		it("terms('categories').listPaginated() returns pagination metadata", async () => {
			const result = await categoriesClient(publicClient).listPaginated({
				include: seededCategoryIds,
				perPage: 2,
				page: 1,
			});

			expect(result.data).toHaveLength(2);
			expect(result.total).toBe(6);
			expect(result.totalPages).toBe(3);
			expect(result.page).toBe(1);
		});
	});

	describe("crud", () => {
		it("creates, updates, and deletes categories", async () => {
			const created = await categoriesClient(authClient).create({
				name: "Client CRUD Category",
				description: "Category created by integration tests.",
			});

			createdCategoryIds.push(created.id);

			expect(created.name).toBe("Client CRUD Category");
			expect(created.taxonomy).toBe("category");

			const updated = await categoriesClient(authClient).update(created.id, {
				name: "Client CRUD Category Updated",
			});

			expect(updated.name).toBe("Client CRUD Category Updated");

			const deleted = await categoriesClient(authClient).delete(created.id, {
				force: true,
			});
			expect(deleted.deleted).toBe(true);
		});

		it("throws for unauthenticated category creation", async () => {
			await expect(
				categoriesClient(publicClient).create({
					name: "Client CRUD Public Category",
				}),
			).rejects.toMatchObject({
				name: "WordPressHttpError",
			});
		});

		it("throws for a non-existent category on update", async () => {
			await expect(
				categoriesClient(authClient).update(999999, { name: "Ghost Category" }),
			).rejects.toMatchObject({
				name: "WordPressHttpError",
				status: 404,
			});
		});
	});
});
