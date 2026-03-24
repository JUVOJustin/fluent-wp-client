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

// Read a list of posts
const posts = await wp.getPosts({ perPage: 10 });

// Read a single post and parse its Gutenberg blocks
const blocks = await wp.getPostBySlug('hello-world').getBlocks();

// Create a draft post (requires auth)
const draft = await wp.createPost({ title: 'Hello', status: 'draft' });
```

## Features

- **Typed helpers** for posts, pages, media, categories, tags, users, comments, and settings
- **Cross-resource search** — `searchContent()` queries across posts, pages, and CPTs via the `/wp/v2/search` endpoint
- **Extensible collection filters** — built-in list helpers and generic resource builders accept typed core filters plus extra endpoint-specific query params
- **Generic CPT and taxonomy builders** — `content('books')` and `terms('genre')` work for any registered resource
- **Flexible CPT defaults** — generic content reads tolerate post types that omit `title`, `content`, `excerpt`, or `author`
- **Gutenberg block parsing** — single-post queries expose `.getBlocks()` and `.getContent()`
- **Auth flexibility** — Basic auth (application passwords), JWT, cookie+nonce, prebuilt headers, and per-request signing
- **WPAPI-compatible fluent syntax** — migrate from `node-wpapi` with minimal changes
- **WordPress Abilities API** — discover and execute registered abilities with optional schema validation
- **Standard Schema validation** — validator-agnostic root exports; native Zod available from `fluent-wp-client/zod`
- **Extensible relation API** — fluent relations for posts and custom entities, plus generic ID-backed and shared link/embed relation factories

## Flexible collection filters

Collection helpers keep typed core filters like `search`, `include`, `exclude`, and `slug`, and they also forward extra endpoint-specific params for plugin or project-specific REST extensions.

```ts
const posts = await wp.getPosts({
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
- [Migrate from node-wpapi](./docs/migration-from-node-wpapi.mdx) — migration guide

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
