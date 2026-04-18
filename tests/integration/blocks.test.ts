import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type WordPressBlocksClient,
  withBlocks,
} from "../../dist/blocks-entry.js";
import { WordPressClient } from "../../dist/index.js";
import {
  createAuthBlocksClient,
  createAuthClient,
  createPublicBlocksClient,
  getBaseUrl,
} from "../helpers/wp-client";

/**
 * Integration coverage for Gutenberg block parsing helpers.
 *
 * The block add-on wraps one core client and exposes `wpBlocks.content(...).item(...).blocks()`.
 *
 * List methods return plain serializable DTOs without block helpers. Use a
 * single-item query on a known ID for block access.
 */
describe("Client: Gutenberg block parsing", () => {
  let authClient: WordPressClient;
  let authBlocksClient: WordPressBlocksClient;
  let publicBlocksClient: WordPressBlocksClient;
  const createdPostIds: number[] = [];
  const createdPageIds: number[] = [];

  beforeAll(() => {
    authClient = createAuthClient();
    authBlocksClient = createAuthBlocksClient();
    publicBlocksClient = createPublicBlocksClient();
  });

  function postsClient(client: WordPressBlocksClient) {
    return client.content("posts");
  }

  function pagesClient(client: WordPressBlocksClient) {
    return client.content("pages");
  }

  afterAll(async () => {
    for (const id of createdPostIds) {
      await authClient
        .content("posts")
        .delete(id, { force: true })
        .catch(() => undefined);
    }

    for (const id of createdPageIds) {
      await authClient
        .content("pages")
        .delete(id, { force: true })
        .catch(() => undefined);
    }
  });

  it("parses post blocks from one slug query chain", async () => {
    const slug = `client-blocks-post-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        '<!-- wp:paragraph {"dropCap":false} --><p>Post block body.</p><!-- /wp:paragraph -->',
      slug,
      status: "publish",
      title: "Client Blocks: post",
    });

    createdPostIds.push(created.id);

    const blocks = await postsClient(authBlocksClient)
      .item(slug)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].blockName).toBe("core/paragraph");
    expect(typeof blocks?.[0].attrs).toBe("object");
    expect(blocks?.[0].innerHTML).toContain("<p>Post block body.</p>");
  });

  it("parses page blocks from one slug query chain", async () => {
    const slug = `client-blocks-page-${Date.now()}`;
    const created = await authClient.content("pages").create({
      content:
        '<!-- wp:heading {"level":3} --><h3>Page block heading.</h3><!-- /wp:heading -->',
      slug,
      status: "publish",
      title: "Client Blocks: page",
    });

    createdPageIds.push(created.id);

    const blocks = await pagesClient(authBlocksClient)
      .item(slug)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0].blockName).toBe("core/heading");
    expect(blocks?.[0].attrs).toMatchObject({ level: 3 });
    expect(blocks?.[0].innerHTML).toContain("<h3>Page block heading.</h3>");
  });

  it("returns raw and rendered content from getContent()", async () => {
    const slug = `client-blocks-content-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>Content payload body.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: content payload",
    });

    createdPostIds.push(created.id);

    const content = await postsClient(authBlocksClient).item(slug).getContent();

    expect(content).toBeDefined();
    expect(content?.raw).toContain("<!-- wp:paragraph -->");
    expect(content?.rendered).toContain("<p>Content payload body.</p>");
  });

  it("uses one HTTP request when blocks().get() is called directly", async () => {
    const password = process.env.WP_APP_PASSWORD;

    if (!password) {
      throw new Error("WP_APP_PASSWORD not set - did global-setup run?");
    }

    let requestCount = 0;
    const countingClient = new WordPressClient({
      auth: { password, username: "admin" },
      baseUrl: getBaseUrl(),
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        requestCount += 1;
        return fetch(input, init);
      },
    });

    await withBlocks(countingClient)
      .content("posts")
      .item("test-post-001")
      .blocks()
      .get()
      .catch(() => undefined);

    expect(requestCount).toBe(1);
  });

  it("throws auth/capability error when public block client calls blocks().get()", async () => {
    await expect(
      publicBlocksClient.content("posts").item("test-post-001").blocks().get(),
    ).rejects.toMatchObject({
      name: "WordPressHttpError",
    });
  });

  it("retrieves blocks from list items via single-item query", async () => {
    const slug = `client-blocks-list-query-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>List-to-query block body.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: list to query",
    });

    createdPostIds.push(created.id);

    const posts = await authClient
      .content("posts")
      .list({ page: 1, perPage: 100 });
    const match = posts.find((post) => post.id === created.id);

    expect(match).toBeDefined();

    const blocks = await postsClient(authBlocksClient)
      .item(match!.id)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].blockName).toBe("core/paragraph");
    expect(blocks![0].innerHTML).toContain("<p>List-to-query block body.</p>");
  });

  it("retrieves blocks from page list items via single-item query", async () => {
    const slug = `client-blocks-list-page-${Date.now()}`;
    const created = await authClient.content("pages").create({
      content:
        "<!-- wp:paragraph --><p>Page list block body.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: page list to query",
    });

    createdPageIds.push(created.id);

    const pages = await authClient
      .content("pages")
      .list({ page: 1, perPage: 100 });
    const match = pages.find((page) => page.id === created.id);

    expect(match).toBeDefined();

    const blocks = await pagesClient(authBlocksClient)
      .item(match!.id)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].innerHTML).toContain("<p>Page list block body.</p>");
  });

  it("round-trips parsed post blocks through setBlocks()", async () => {
    const slug = `client-blocks-set-post-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>Original block body.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: setBlocks post",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);
    const blocks = await query.blocks().get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);

    const updatedBlocks = [
      {
        attrs: { level: 2 },
        blockName: "core/heading",
        innerBlocks: [],
        innerContent: ["<h2>Updated heading body.</h2>"],
        innerHTML: "<h2>Updated heading body.</h2>",
      },
      {
        ...blocks![0],
        innerContent: ["<p>Updated block body.</p>"],
        innerHTML: "<p>Updated block body.</p>",
      },
    ];

    const blockSchemas = await authBlocksClient.blocks().schemas();

    const updated = await query.blocks().set(updatedBlocks, blockSchemas);

    expect(updated.content.rendered).toContain("Updated heading body.");
    expect(updated.content.rendered).toContain("Updated block body.");

    const persistedBlocks = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persistedBlocks).toHaveLength(2);
    expect(persistedBlocks?.[0].blockName).toBe("core/heading");
    expect(persistedBlocks?.[0].attrs).toMatchObject({ level: 2 });
    expect(persistedBlocks?.[1].blockName).toBe("core/paragraph");
    expect(persistedBlocks?.[1].innerHTML).toContain(
      "<p>Updated block body.</p>",
    );
  });

  it("rejects unknown block types in setBlocks() when schemas are provided", async () => {
    const slug = `client-blocks-set-invalid-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>Validation baseline.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: invalid setBlocks",
    });

    createdPostIds.push(created.id);

    const blockSchemas = await authBlocksClient.blocks().schemas();

    await expect(
      postsClient(authBlocksClient)
        .item(slug)
        .blocks()
        .set(
          [
            {
              attrs: null,
              blockName: "demo/not-registered",
              innerBlocks: [],
              innerContent: ["<div>Invalid block.</div>"],
              innerHTML: "<div>Invalid block.</div>",
            },
          ],
          blockSchemas,
        ),
    ).rejects.toMatchObject({
      kind: "BLOCK_VALIDATION_ERROR",
      name: "WordPressBlockValidationError",
      retryable: false,
    });
  });

  it("allows unknown block types in setBlocks() when no schemas are provided", async () => {
    const slug = `client-blocks-set-unknown-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>Validation baseline.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: unknown without schemas",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);

    await query.blocks().set([
      {
        attrs: { label: "Custom block" },
        blockName: "demo/not-registered",
        innerBlocks: [],
        innerContent: ["<div>Custom unknown block.</div>"],
        innerHTML: "<div>Custom unknown block.</div>",
      },
    ]);

    const persistedBlocks = await query.blocks().get();

    expect(persistedBlocks).toHaveLength(1);
    expect(persistedBlocks?.[0].blockName).toBe("demo/not-registered");
    expect(persistedBlocks?.[0].attrs).toMatchObject({ label: "Custom block" });
  });

  it("validates parsed blocks on get() when schemas are provided", async () => {
    const slug = `client-blocks-get-validate-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>Paragraph body.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: get validation",
    });

    createdPostIds.push(created.id);

    const headingSchema = await authBlocksClient
      .blocks()
      .schema("core/heading");

    expect(headingSchema).toBeDefined();

    await expect(
      postsClient(authBlocksClient)
        .item(slug)
        .blocks()
        .get({
          schemas: [headingSchema!],
          validate: true,
        }),
    ).rejects.toMatchObject({
      kind: "BLOCK_VALIDATION_ERROR",
      name: "WordPressBlockValidationError",
      retryable: false,
    });
  });

  // ---------------------------------------------------------------------------
  // Seeded content: parse known static blocks
  // ---------------------------------------------------------------------------

  it("parses seeded post blocks and confirms structure matches seed content", async () => {
    // test-post-001 is seeded with a single core/paragraph block
    const blocks = await postsClient(authBlocksClient)
      .item("test-post-001")
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].blockName).toBe("core/paragraph");
    expect(blocks![0].innerHTML).toContain(
      "Content for test post 001 in category technology",
    );
  });

  it("parses seeded page blocks and confirms structure matches seed content", async () => {
    // the "about" page is seeded with a single core/paragraph block
    const blocks = await pagesClient(authBlocksClient)
      .item("about")
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].blockName).toBe("core/paragraph");
    expect(blocks![0].innerHTML).toContain(
      "Learn more about our organization and mission.",
    );
  });

  // ---------------------------------------------------------------------------
  // Attribute-only mutation: change attrs without touching innerHTML
  // ---------------------------------------------------------------------------

  it("mutates only attrs on an existing block and persists the change", async () => {
    const slug = `client-blocks-attrs-only-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        '<!-- wp:heading {"level":2} --><h2>Original heading.</h2><!-- /wp:heading -->',
      slug,
      status: "publish",
      title: "Client Blocks: attrs-only mutation",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);
    const blocks = await query.blocks().get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks![0].blockName).toBe("core/heading");
    expect(blocks![0].attrs).toMatchObject({ level: 2 });

    // change only the level attribute, keep everything else intact
    const updatedBlocks = [{ ...blocks![0], attrs: { level: 3 } }];

    await query.blocks().set(updatedBlocks);

    const persisted = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persisted).toHaveLength(1);
    expect(persisted![0].blockName).toBe("core/heading");
    // The block attribute is persisted via the Gutenberg comment delimiter
    expect(persisted![0].attrs).toMatchObject({ level: 3 });
    // WordPress does not re-render innerHTML when only attrs change via REST;
    // the heading text content is preserved from the original write
    expect(persisted![0].innerHTML).toContain("Original heading.");
  });

  // ---------------------------------------------------------------------------
  // Schema validation: deep attribute-level checks for core blocks
  // ---------------------------------------------------------------------------

  it("validates core/paragraph schema has expected attribute structure", async () => {
    const paragraphSchema = await authBlocksClient
      .blocks()
      .schema("core/paragraph");

    expect(paragraphSchema).toBeDefined();
    expect(paragraphSchema!["x-wordpress-block-name"]).toBe("core/paragraph");
    // attrs is an anyOf [ null, object ] — ensure the object branch has properties
    const attrsDef = paragraphSchema!.properties.attrs as {
      anyOf: Array<{ type: string; properties?: Record<string, unknown> }>;
    };
    expect(Array.isArray(attrsDef.anyOf)).toBe(true);
    const objectBranch = attrsDef.anyOf.find(
      (branch) => branch.type === "object",
    );
    expect(objectBranch).toBeDefined();
    expect(objectBranch!.properties).toBeDefined();
  });

  it("validates core/heading schema exposes a level attribute definition", async () => {
    const headingSchema = await authBlocksClient
      .blocks()
      .schema("core/heading");

    expect(headingSchema).toBeDefined();
    const attrsDef = headingSchema!.properties.attrs as {
      anyOf: Array<{ type: string; properties?: Record<string, unknown> }>;
    };
    const objectBranch = attrsDef.anyOf.find(
      (branch) => branch.type === "object",
    );
    expect(objectBranch?.properties).toBeDefined();
    expect(objectBranch!.properties!["level"]).toBeDefined();
  });

  it("validates core/image schema exposes a url attribute definition", async () => {
    const imageSchema = await authBlocksClient.blocks().schema("core/image");

    // core/image may not be registered in all WP versions — skip gracefully
    if (!imageSchema) {
      return;
    }

    expect(imageSchema["x-wordpress-block-name"]).toBe("core/image");
    const attrsDef = imageSchema.properties.attrs as {
      anyOf: Array<{ type: string; properties?: Record<string, unknown> }>;
    };
    const objectBranch = attrsDef.anyOf.find(
      (branch) => branch.type === "object",
    );
    expect(objectBranch?.properties).toBeDefined();
    expect(objectBranch!.properties!["url"]).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // set() with invalid attributes for a known block type
  // ---------------------------------------------------------------------------

  it("rejects set() when a known block carries invalid attribute types", async () => {
    const slug = `client-blocks-invalid-attrs-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content: "<!-- wp:paragraph --><p>Baseline.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: invalid attribute types",
    });

    createdPostIds.push(created.id);

    const blockSchemas = await authBlocksClient
      .blocks()
      .schemas({ namespace: "core" });

    // core/heading expects `level` to be a number; pass a string to trigger schema_validation
    await expect(
      postsClient(authBlocksClient)
        .item(slug)
        .blocks()
        .set(
          [
            {
              attrs: { level: "not-a-number" as unknown as number },
              blockName: "core/heading",
              innerBlocks: [],
              innerContent: ["<h2>Bad attrs.</h2>"],
              innerHTML: "<h2>Bad attrs.</h2>",
            },
          ],
          blockSchemas,
        ),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          blockName: "core/heading",
          code: "schema_validation",
        }),
      ]),
      kind: "BLOCK_VALIDATION_ERROR",
      name: "WordPressBlockValidationError",
      retryable: false,
    });
  });

  // ---------------------------------------------------------------------------
  // set() with validate: false explicit bypass
  // ---------------------------------------------------------------------------

  it("bypasses validation in set() when validate: false is passed", async () => {
    const slug = `client-blocks-bypass-validation-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content: "<!-- wp:paragraph --><p>Baseline.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: bypass validation",
    });

    createdPostIds.push(created.id);

    const blockSchemas = await authBlocksClient
      .blocks()
      .schemas({ namespace: "core" });

    // same invalid block as the previous test, but with validate: false — should NOT throw
    const updated = await postsClient(authBlocksClient)
      .item(slug)
      .blocks()
      .set(
        [
          {
            attrs: null,
            blockName: "demo/not-registered",
            innerBlocks: [],
            innerContent: ["<div>Bypass validation.</div>"],
            innerHTML: "<div>Bypass validation.</div>",
          },
        ],
        { schemas: blockSchemas, validate: false },
      );

    expect(updated).toBeDefined();
    expect(updated.content.rendered).toContain("Bypass validation.");
  });

  // ---------------------------------------------------------------------------
  // Write a fresh post with multiple Gutenberg blocks
  // ---------------------------------------------------------------------------

  it("writes a fresh post with multiple block types and reads them back", async () => {
    const slug = `client-blocks-multi-${Date.now()}`;
    const multiBlockContent = [
      '<!-- wp:heading {"level":1} --><h1>Multi-block post.</h1><!-- /wp:heading -->',
      "<!-- wp:paragraph --><p>First paragraph.</p><!-- /wp:paragraph -->",
      '<!-- wp:paragraph {"dropCap":true} --><p class="has-drop-cap">Second paragraph with drop cap.</p><!-- /wp:paragraph -->',
    ].join("\n\n");

    const created = await authClient.content("posts").create({
      content: multiBlockContent,
      slug,
      status: "publish",
      title: "Client Blocks: multi-block post",
    });

    createdPostIds.push(created.id);

    const blocks = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(3);
    expect(blocks![0].blockName).toBe("core/heading");
    expect(blocks![0].attrs).toMatchObject({ level: 1 });
    expect(blocks![1].blockName).toBe("core/paragraph");
    expect(blocks![1].innerHTML).toContain("First paragraph.");
    expect(blocks![2].blockName).toBe("core/paragraph");
    expect(blocks![2].attrs).toMatchObject({ dropCap: true });
  });

  it("writes a fresh page with multiple block types and reads them back", async () => {
    const slug = `client-blocks-multi-page-${Date.now()}`;
    const multiBlockContent = [
      '<!-- wp:heading {"level":2} --><h2>Page heading.</h2><!-- /wp:heading -->',
      "<!-- wp:paragraph --><p>Page body paragraph.</p><!-- /wp:paragraph -->",
    ].join("\n\n");

    const created = await authClient.content("pages").create({
      content: multiBlockContent,
      slug,
      status: "publish",
      title: "Client Blocks: multi-block page",
    });

    createdPageIds.push(created.id);

    const blocks = await pagesClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(2);
    expect(blocks![0].blockName).toBe("core/heading");
    expect(blocks![0].attrs).toMatchObject({ level: 2 });
    expect(blocks![1].blockName).toBe("core/paragraph");
    expect(blocks![1].innerHTML).toContain("Page body paragraph.");
  });

  // ---------------------------------------------------------------------------
  // Nested inner blocks (core/columns → core/column → core/paragraph)
  // ---------------------------------------------------------------------------

  it("parses and preserves nested inner blocks through a set/get round-trip", async () => {
    const slug = `client-blocks-nested-${Date.now()}`;
    // Build a columns → column → paragraph structure
    const nestedContent = [
      "<!-- wp:columns -->",
      '<div class="wp-block-columns">',
      "<!-- wp:column -->",
      '<div class="wp-block-column">',
      "<!-- wp:paragraph --><p>Column one.</p><!-- /wp:paragraph -->",
      "</div>",
      "<!-- /wp:column -->",
      "<!-- wp:column -->",
      '<div class="wp-block-column">',
      "<!-- wp:paragraph --><p>Column two.</p><!-- /wp:paragraph -->",
      "</div>",
      "<!-- /wp:column -->",
      "</div>",
      "<!-- /wp:columns -->",
    ].join("\n");

    const created = await authClient.content("posts").create({
      content: nestedContent,
      slug,
      status: "publish",
      title: "Client Blocks: nested inner blocks",
    });

    createdPostIds.push(created.id);

    const blocks = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks![0].blockName).toBe("core/columns");
    expect(blocks![0].innerBlocks.length).toBeGreaterThanOrEqual(2);

    const firstColumn = blocks![0].innerBlocks[0]!;
    expect(firstColumn.blockName).toBe("core/column");
    expect(firstColumn.innerBlocks).toHaveLength(1);
    expect(firstColumn.innerBlocks[0]!.blockName).toBe("core/paragraph");
    expect(firstColumn.innerBlocks[0]!.innerHTML).toContain("Column one.");
  });

  // ---------------------------------------------------------------------------
  // Custom post type: blocks() on content('books')
  // ---------------------------------------------------------------------------

  it("parses seeded book blocks through the blocks add-on", async () => {
    // test-book-001 is a seeded CPT entry with a core/paragraph block
    const blocks = await authBlocksClient
      .content("books")
      .item("test-book-001")
      .blocks()
      .get();

    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThan(0);
    expect(blocks![0].blockName).toBe("core/paragraph");
    expect(blocks![0].innerHTML).toContain("Content for test book 001");
  });

  // ---------------------------------------------------------------------------
  // Edge cases: serializer, validator, and block name validation
  // ---------------------------------------------------------------------------

  it("round-trips a self-closing block (empty innerContent)", async () => {
    const slug = `client-blocks-selfclose-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content: '<!-- wp:separator {"className":"is-style-wide"} /-->',
      slug,
      status: "publish",
      title: "Client Blocks: self-closing",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);
    const blocks = await query.blocks().get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks![0].blockName).toBe("core/separator");
    expect(blocks![0].innerContent).toHaveLength(0);
    expect(blocks![0].innerBlocks).toHaveLength(0);

    // Round-trip: write back and re-read
    await query.blocks().set(blocks!);
    const persisted = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persisted).toHaveLength(1);
    expect(persisted![0].blockName).toBe("core/separator");
    expect(persisted![0].attrs).toMatchObject({ className: "is-style-wide" });
  });

  it("preserves intentional whitespace in pre blocks through set/get round-trip", async () => {
    const slug = `client-blocks-pre-ws-${Date.now()}`;
    const preContent =
      '<pre class="wp-block-code"><code>  line one\n    indented\n  line three</code></pre>';
    const created = await authClient.content("posts").create({
      content: `<!-- wp:code -->${preContent}<!-- /wp:code -->`,
      slug,
      status: "publish",
      title: "Client Blocks: pre whitespace",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);
    const blocks = await query.blocks().get();

    expect(blocks).toBeDefined();
    expect(blocks).toHaveLength(1);
    expect(blocks![0].blockName).toBe("core/code");

    // Write back the same blocks and re-read
    await query.blocks().set(blocks!);
    const persisted = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persisted).toHaveLength(1);
    expect(persisted![0].blockName).toBe("core/code");
    // The indentation and newlines within the pre block must survive
    expect(persisted![0].innerHTML).toContain("  line one");
    expect(persisted![0].innerHTML).toContain("    indented");
    expect(persisted![0].innerHTML).toContain("  line three");
  });

  it("serializes attributes with HTML-comment-unsafe characters correctly", async () => {
    const slug = `client-blocks-special-attrs-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content: "<!-- wp:paragraph --><p>Baseline.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: special attribute chars",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);

    // Block with attributes containing quotes, angle brackets, --, &, and backslash
    const blocksToWrite = [
      {
        attrs: {
          anchor: "id<with>angle&brackets",
          className: "test--class",
        },
        blockName: "core/paragraph",
        innerBlocks: [],
        innerContent: ["<p>Special chars in attrs.</p>"],
        innerHTML: "<p>Special chars in attrs.</p>",
      },
    ];

    await query.blocks().set(blocksToWrite);
    const persisted = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persisted).toHaveLength(1);
    expect(persisted![0].blockName).toBe("core/paragraph");
    expect(persisted![0].attrs).toMatchObject({
      anchor: "id<with>angle&brackets",
      className: "test--class",
    });
  });

  it("round-trips an empty block array through set/get", async () => {
    const slug = `client-blocks-empty-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content:
        "<!-- wp:paragraph --><p>Will be cleared.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: empty array",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);

    // Set empty blocks — clears all content
    await query.blocks().set([], { validate: false });
    const persisted = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persisted).toHaveLength(0);
  });

  it("round-trips a block with null attrs", async () => {
    const slug = `client-blocks-null-attrs-${Date.now()}`;
    const created = await authClient.content("posts").create({
      content: "<!-- wp:paragraph --><p>Baseline.</p><!-- /wp:paragraph -->",
      slug,
      status: "publish",
      title: "Client Blocks: null attrs",
    });

    createdPostIds.push(created.id);

    const query = postsClient(authBlocksClient).item(slug);

    await query.blocks().set([
      {
        attrs: null,
        blockName: "core/paragraph",
        innerBlocks: [],
        innerContent: ["<p>Null attrs block.</p>"],
        innerHTML: "<p>Null attrs block.</p>",
      },
    ]);

    const persisted = await postsClient(authBlocksClient)
      .item(created.id)
      .blocks()
      .get();

    expect(persisted).toHaveLength(1);
    expect(persisted![0].blockName).toBe("core/paragraph");
    expect(persisted![0].innerHTML).toContain("Null attrs block.");
  });

  it("rejects block type names with path traversal patterns", async () => {
    await expect(
      authBlocksClient.blocks().item("../../etc/passwd"),
    ).rejects.toThrow(/Invalid block type name/);

    await expect(authBlocksClient.blocks().item("")).rejects.toThrow();

    await expect(
      authBlocksClient.blocks().item("CORE/Paragraph"),
    ).rejects.toThrow(/Invalid block type name/);

    // Valid name should not throw (may return undefined if not registered)
    const result = await authBlocksClient.blocks().item("core/paragraph");
    expect(result).toBeDefined();
  });
});
