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

// Read a single post and parse its Gutenberg blocks
const blocks = await posts.item('hello-world').getBlocks();

// Create a draft post (requires auth)
const draft = await posts.create({ title: 'Hello', status: 'draft' });
```

## Features

- **Unified typed content builders** — `content('posts')`, `content('pages')`, `content('books')`, and `terms('genre')` share one API shape, with stricter typing for built-in resources
- **First-class fluent resource clients** — `media()`, `comments()`, `users()`, and `settings()` expose consistent `list/item/create/update/delete/describe` APIs, with `upload()` for media, `.with(...)` on item reads, and `me()` for users
- **Cross-resource search** — `searchContent()` queries across posts, pages, and CPTs via the `/wp/v2/search` endpoint
- **Parallel bulk fetching** — `listAll()` fetches all pages in parallel batches for dramatic speed improvements on large datasets
- **Rate limiting support** — `onRequest` callback lets you implement custom rate limiting or request logging
- **Extensible collection filters** — built-in list helpers and generic resource builders accept typed core filters plus extra endpoint-specific query params
- **Lean embedded payloads** — post-like DTO reads skip `_embed` by default, while relation hydration turns it on automatically when `.with(...)` is used
- **Flexible CPT defaults** — generic content reads tolerate post types that omit `title`, `content`, `excerpt`, or `author`
- **Gutenberg block parsing** — single-item queries expose `.getBlocks()` and `.getContent()`
- **Auth flexibility** — Basic auth (application passwords), JWT, cookie+nonce, prebuilt headers, and per-request signing
- **WordPress Abilities API** — discover and execute registered abilities with optional schema validation
- **Standard Schema validation** — validator-agnostic root exports; native Zod available from `fluent-wp-client/zod`, with schema-backed generic builders validating reads and mutations
- **Extensible relation API** — fluent relations for posts and custom entities, plus generic ID-backed and shared link/embed relation factories

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

// Token bucket rate limiter
const rateLimiter = new TokenBucketLimiter({ tokensPerSecond: 10, maxTokens: 20 });
const wp = new WordPressClient({
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

Post-like DTO reads stay lean by default. Pass `embed: true` on collection filters when you need raw `_embedded` data, and use relation queries when you want the client to hydrate related entities automatically.

```ts
const embeddedPosts = await wp.content('posts').list({ perPage: 10, embed: true });

const hydratedPost = await wp.content('posts')
  .item('hello-world')
  .with('author', 'terms');
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
- [Gutenberg content](./docs/gutenberg-content.mdx) — block parsing and content workflows
- [Custom endpoints](./docs/custom-endpoints.mdx) — custom post types, taxonomies, and plugin namespaces
- [Abilities](./docs/abilities.mdx) — WordPress Abilities API
- [Validation](./docs/validation.mdx) — Standard Schema, Zod, and custom validators
- [Extensible relations](./docs/extensible-relations.mdx) — ACF field-type helpers, custom relation registration, and generic relation factories for IDs and shared link/embed buckets

## Development

```bash
# Start the local WordPress environment
npm run wp:start

# Run the integration test suite
npm test

# Stop the environment
npm run wp:stop
```

Core transport, mutation helpers, query primitives, and base resource classes live under `src/core/`, while relation contracts, relation definition factories, and the fluent relation builder live under `src/builders/`. Package consumers continue to import the public API from `src/index.ts`.

Tests run against a real WordPress Docker container managed by [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). See [`tests/`](./tests/) for setup details.

## License

MIT
