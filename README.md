# fluent-wp-client

Runtime-agnostic TypeScript client for the WordPress REST API.

Works on **Node.js**, **Deno**, **Bun**, and in the **browser** — using only web-standard APIs (`fetch`, `URL`, `Blob`).

## Install

```bash
npm install fluent-wp-client
```

## Quick start

```ts
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
});

const posts = wp.content('posts');

// Read a list of posts
const recentPosts = await posts.list({ perPage: 10 });

// First-class resources use the same fluent style
const comments = await wp.comments().list({ post: 42 });

// Read a single post
const post = await posts.item('hello-world');

// Create a draft post (requires auth)
const draft = await posts.create({ title: 'Hello', status: 'draft' });
```

## Features

- **Unified typed content builders** — `content('posts')`, `content('pages')`, `content('books')`, and `terms('genre')` share one API shape, with stricter typing for built-in resources
- **First-class fluent resource clients** — `media()`, `comments()`, `users()`, and `settings()` expose consistent `list/item/create/update/delete/describe` APIs, with `upload()` for media and `me()` for users
- **Cross-resource search** — `searchContent()` queries across posts, pages, and CPTs via the `/wp/v2/search` endpoint
- **Parallel bulk fetching** — `listAll()` fetches all pages in parallel batches for dramatic speed improvements on large datasets
- **Rate limiting support** — `onRequest` callback lets you implement custom rate limiting or request logging
- **Extensible collection filters** — built-in list helpers and generic resource builders accept typed core filters plus extra endpoint-specific query params
- **Lean embedded payloads** — post-like DTO reads skip `_embed` by default; opt in with `embed: true` or selective `embed: ['author', 'wp:term']` and use typed extraction helpers
- **Flexible CPT defaults** — generic content reads tolerate post types that omit `title`, `content`, `excerpt`, or `author`
- **Portable Gutenberg block add-on** — `fluent-wp-client/blocks` adds block type discovery, generated block JSON Schemas, parse/serialize/validate helpers, and explicit `.blocks().get()` / `.blocks().set()` content workflows
- **AI SDK tool factories** — `fluent-wp-client/ai-sdk` exposes manually composable Vercel AI SDK tools for content reads, mutations, abilities, and block workflows
- **CLI schema/code generation** — `fluent-wp-client` ships a CLI for discovering resource schemas and generating TypeScript, JSON Schema, and Zod outputs
- **Auth flexibility** — Basic auth (application passwords), JWT, cookie+nonce, prebuilt headers, and per-request signing
- **WordPress Abilities API** — discover and execute registered abilities with the same upstream-validated model as the rest of WordPress
- **Schema discovery and custom validation** — validator-agnostic root exports plus `.describe()`, `.explore()`, and CLI schema generation for app-level Zod, Valibot, or custom validation
- **Embed extraction helpers** — `getEmbeddedAuthor()`, `getEmbeddedTerms()`, `getEmbeddedFeaturedMedia()`, `getEmbeddedParent()`, plus ACF helpers like `getAcfFieldPosts()` and `getAcfFieldTerms()`

## Gutenberg block workflows

Use the dedicated block add-on when you need block parsing, validation, or block type discovery:

```ts
import { WordPressClient } from 'fluent-wp-client';
import { withBlocks } from 'fluent-wp-client/blocks';

const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { username: 'admin', password: 'app-password' },
});

const wpBlocks = withBlocks(wp);
const blockSchemas = await wpBlocks.blocks().schemas();
const postQuery = wpBlocks.content('posts').item('hello-world');
const blocks = await postQuery.blocks().get({
  schemas: blockSchemas,
  validate: true,
});

blocks[0].innerHTML = '<p>Updated paragraph body.</p>';
blocks[0].innerContent = ['<p>Updated paragraph body.</p>'];

await postQuery.blocks().set(blocks, blockSchemas);
```

Standalone helpers are also available when you already have raw `content.raw`:

```ts
import {
  createWordPressBlockJsonSchemas,
  parseWordPressBlocks,
  serializeWordPressBlocks,
  validateWordPressBlocks,
} from 'fluent-wp-client/blocks';

const blockTypes = await wpBlocks.blocks().list();
const blockSchemas = createWordPressBlockJsonSchemas(blockTypes);
const blocks = await parseWordPressBlocks(content.raw);
const result = await validateWordPressBlocks(blocks, {
  schemas: blockSchemas,
});

if (result.valid) {
  const nextContent = await serializeWordPressBlocks(blocks);
}
```

`blocks().set()` does not implicitly fetch block types. Pass the schemas you want to allow when you need whitelist validation.

If you want native Zod schemas for AI-produced block trees, import them from `fluent-wp-client/blocks/zod`.

## AI SDK Integration

Use the optional `fluent-wp-client/ai-sdk` entrypoint when you want manually composable [Vercel AI SDK](https://sdk.vercel.ai/) tools built on top of your WordPress client instance.

```ts
import { WordPressClient } from 'fluent-wp-client';
import {
  getContentCollectionTool,
  getContentTool,
  createContentTool,
} from 'fluent-wp-client/ai-sdk';

const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { username: 'editor', password: 'app-password' },
});

await wp.explore();

const tools = {
  searchPosts: getContentCollectionTool(wp, {
    contentType: 'posts',
    fixedArgs: { perPage: 5, status: 'publish' },
  }),
  readContent: getContentTool(wp),
  draftPost: createContentTool(wp, {
    contentType: 'posts',
    fixedInput: { status: 'draft' },
  }),
};
```

See `docs/ai-sdk.mdx` for the full tool catalog and configuration model.

## CLI

Use the built-in CLI to discover WordPress REST schemas and generate code artifacts:

```bash
npx fluent-wp-client schemas --url https://example.com
npx fluent-wp-client schemas --url https://example.com --format both
```

The `schemas` command can emit JSON Schema, Zod-ready TypeScript modules, or both.

## Rate limiting and request control

Use the `onRequest` callback to implement rate limiting, request logging, or other custom logic:

```ts
// Simple delay between requests
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  onRequest: async (url, init) => {
    await new Promise(resolve => setTimeout(resolve, 100));
  },
});
```

```ts
// Token bucket rate limiter
const rateLimiter = new TokenBucketLimiter({ tokensPerSecond: 10, maxTokens: 20 });
const wpWithRateLimit = new WordPressClient({
  baseUrl: 'https://example.com',
  onRequest: async (url, init) => {
    await rateLimiter.acquireToken();
  },
});
```

## Parallel bulk fetching

`listAll()` automatically fetches pages in parallel for maximum performance. It fetches the first page to get the total count, then spawns parallel requests for remaining pages in configurable batches:

```ts
// Fetch all posts with default concurrency (5 pages at a time)
const allPosts = await wp.content('posts').listAll();

// Higher concurrency for faster fetching (use with caution)
const allUsers = await wp.users().listAll({}, {}, { concurrency: 10 });

// Lower concurrency to be gentler on the server
const allComments = await wp.comments().listAll({}, {}, { concurrency: 2 });
```

The `explore()` API also makes parallel requests when discovering all resources, dramatically speeding up schema discovery.

## Flexible collection filters

Collection helpers keep typed core filters like `search`, `include`, `exclude`, and `slug`, and they also forward extra endpoint-specific params for plugin or project-specific REST extensions.

```ts
const posts = await wp.content('posts').list({
  search: 'hello world',
  include: [4, 8],
  titleSearch: 'Hello',
});

const books = await wp.content('books').list({
  include: [164, 165],
  titleSearch: 'Test Book',
});
```

Array params are serialized as repeated `param[]` entries instead of comma-joined strings.

## Embedded data

Post-like DTO reads stay lean by default. Pass `embed: true` or a selective embed array to include related data, then use typed extraction helpers to pull it out:

```ts
import { getEmbeddedAuthor, getEmbeddedTerms } from 'fluent-wp-client';

const post = await wp.content('posts').item('hello-world', { embed: true });
const author = getEmbeddedAuthor(post);
const categories = getEmbeddedTerms(post, 'category');

// Selective embed reduces server-side work
const post2 = await wp.content('posts').item('hello-world', {
  embed: ['author', 'wp:term'],
});

// Embed on lists
const posts = await wp.content('posts').list({ perPage: 10, embed: true });
```

## Auth examples

```ts
// Basic auth (WordPress application passwords)
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { username: 'admin', password: 'app-password' },
});

// JWT auth
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { token: 'jwt-token' },
});

// Cookie + nonce (browser sessions)
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { nonce: window.wpApiSettings.nonce, credentials: 'include' },
});
```

## Documentation

Full documentation lives in the [`docs/`](./docs/) folder:

- [Overview](./docs/index.mdx) — feature overview and quick start
- [Usage guide](./docs/usage.mdx) — all client methods, CRUD patterns, pagination, and error handling
- [Authentication](./docs/auth.mdx) — auth strategies and resolver helpers
- [Gutenberg content](./docs/gutenberg-content.mdx) — the `fluent-wp-client/blocks` add-on for block type discovery, parsing, validation, and writes
- [Custom endpoints](./docs/custom-endpoints.mdx) — custom post types, taxonomies, and plugin namespaces
- [Abilities](./docs/abilities.mdx) — WordPress Abilities API
- [Validation](./docs/validation.mdx) — Standard Schema, Zod, and custom validators
- [Embed extraction](./docs/usage.mdx#embed-and-extraction-helpers) — embed parameters, typed extraction helpers, and ACF relation extraction

## Development

```bash
# Start the local WordPress environment
npm run wp:start

# Run the integration test suite
npm test

# Stop the environment
npm run wp:stop
```

Core transport, mutation helpers, query primitives, and base resource classes live under `src/core/`, while query builders live under `src/builders/`. Package consumers continue to import the public API from `src/index.ts`.

Tests run against a real WordPress Docker container managed by [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). See [`tests/`](./tests/) for setup details.

## License

MIT
