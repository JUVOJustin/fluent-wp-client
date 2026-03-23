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
- **Generic CPT and taxonomy APIs** — `content('books')` and `terms('genre')` work for any registered resource
- **Gutenberg block parsing** — single-post queries expose `.getBlocks()` and `.getContent()`
- **Auth flexibility** — Basic auth (application passwords), JWT, cookie+nonce, prebuilt headers, and per-request signing
- **WPAPI-compatible fluent syntax** — migrate from `node-wpapi` with minimal changes
- **WordPress Abilities API** — discover and execute registered abilities with optional schema validation
- **Standard Schema validation** — validator-agnostic root exports; native Zod available from `fluent-wp-client/zod`
- **Relation API** — `wp.post('slug').with('author', 'categories').get()`

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

Tests run against a real WordPress Docker container managed by [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). See [`tests/`](./tests/) for setup details.

## License

MIT
