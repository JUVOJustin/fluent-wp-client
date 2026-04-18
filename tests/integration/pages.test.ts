import type { WordPressClient } from "fluent-wp-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthClient, createPublicClient } from "../helpers/wp-client";

/**
 * Seed data baseline: 10 pages (About, Contact, Services, FAQ, Team, Blog,
 * Portfolio, Testimonials, Privacy Policy, Terms of Service).
 */
describe("Client: Pages", () => {
	let publicClient: WordPressClient;
	let authClient: WordPressClient;
	const createdPageIds: number[] = [];
	const seedPageSlugs = [
		"about",
		"contact",
		"services",
		"faq",
		"team",
		"blog",
		"portfolio",
		"testimonials",
		"privacy-policy",
		"terms-of-service",
	] as const;

	beforeAll(() => {
		publicClient = createPublicClient();
		authClient = createAuthClient();
	});

	function pagesClient(client: WordPressClient) {
		return client.content("pages");
	}

	afterAll(async () => {
		for (const id of createdPageIds) {
			await pagesClient(authClient)
				.delete(id, { force: true })
				.catch(() => undefined);
		}
	});

	describe("reads", () => {
		it("content('pages').list() returns an array of pages", async () => {
			const pages = await pagesClient(publicClient).list();

			expect(Array.isArray(pages)).toBe(true);
			expect(pages.length).toBeGreaterThan(0);
		});

		it("every page has required fields", async () => {
			const pages = await pagesClient(publicClient).list();

			for (const page of pages) {
				expect(page).toHaveProperty("id");
				expect(page).toHaveProperty("slug");
				expect(page).toHaveProperty("title.rendered");
				expect(page).toHaveProperty("content.rendered");
				expect(page).toHaveProperty("date");
				expect(page).toHaveProperty("status");
				expect(page).toHaveProperty("parent");
				expect(page).toHaveProperty("menu_order");
			}
		});

		it("content('pages').item() fetches a known seed page", async () => {
			const page = await pagesClient(publicClient).item("about");

			expect(page).toBeDefined();
			expect(page!.slug).toBe("about");
			expect(page!.title.rendered).toBe("About");
		});

		it("content('pages').item() returns undefined for non-existent slug", async () => {
			const page = await pagesClient(publicClient).item(
				"non-existent-page-slug-999",
			);

			expect(page).toBeUndefined();
		});

		it("content('pages').listAll() includes every seeded page slug", async () => {
			const all = await pagesClient(publicClient).listAll();
			const slugs = new Set(all.map((page) => page.slug));

			for (const slug of seedPageSlugs) {
				expect(slugs.has(slug)).toBe(true);
			}
		});

		it("content('pages').listPaginated() returns pagination metadata", async () => {
			const result = await pagesClient(publicClient).listPaginated({
				perPage: 5,
				page: 1,
			});

			expect(result.data).toHaveLength(5);
			expect(result.total).toBeGreaterThanOrEqual(seedPageSlugs.length);
			expect(result.totalPages).toBeGreaterThanOrEqual(2);
			expect(result.page).toBe(1);
			expect(result.perPage).toBe(5);
		});
	});

	describe("crud", () => {
		it("creates, updates, and deletes pages", async () => {
			const created = await pagesClient(authClient).create({
				title: "Client CRUD: Page create",
				status: "draft",
				menu_order: 7,
			});

			createdPageIds.push(created.id);

			expect(created.type).toBe("page");
			expect(created.menu_order).toBe(7);

			const updated = await pagesClient(authClient).update(created.id, {
				title: "Client CRUD: Page update",
				menu_order: 12,
			});

			expect(updated.title.rendered).toBe("Client CRUD: Page update");
			expect(updated.menu_order).toBe(12);

			const deleted = await pagesClient(authClient).delete(created.id, {
				force: true,
			});
			expect(deleted.deleted).toBe(true);
		});

		it("creates one hierarchical page with parent and content fields", async () => {
			const parent = await pagesClient(authClient).create({
				title: "Client CRUD: Page parent",
				status: "draft",
			});

			createdPageIds.push(parent.id);

			const child = await pagesClient(authClient).create({
				title: "Client CRUD: Page child",
				content: "<p>Child page content.</p>",
				excerpt: "Child page excerpt",
				parent: parent.id,
				menu_order: 5,
				status: "draft",
			});

			createdPageIds.push(child.id);

			expect(child.parent).toBe(parent.id);
			expect(child.menu_order).toBe(5);
			expect(child.content.rendered).toContain("Child page content.");
			expect(child.excerpt.rendered).toContain("Child page excerpt");
		});

		it("updates page-specific hierarchical fields", async () => {
			const parent = await pagesClient(authClient).create({
				title: "Client CRUD: Page update parent",
				status: "draft",
			});

			createdPageIds.push(parent.id);

			const child = await pagesClient(authClient).create({
				title: "Client CRUD: Page update child",
				status: "draft",
			});

			createdPageIds.push(child.id);

			const updated = await pagesClient(authClient).update(child.id, {
				parent: parent.id,
				menu_order: 42,
			});

			expect(updated.parent).toBe(parent.id);
			expect(updated.menu_order).toBe(42);
		});

		it("throws for unauthenticated page creation", async () => {
			await expect(
				pagesClient(publicClient).create({
					title: "Client CRUD: Public page create",
					status: "draft",
				}),
			).rejects.toMatchObject({
				name: "WordPressHttpError",
			});
		});

		it("throws for a non-existent page on update", async () => {
			await expect(
				pagesClient(authClient).update(999999, { title: "Ghost Page" }),
			).rejects.toMatchObject({
				name: "WordPressHttpError",
				status: 404,
			});
		});
	});
});
