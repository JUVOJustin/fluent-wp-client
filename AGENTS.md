# fluent-wp-client

`fluent-wp-client` is a runtime-agnostic typed WordPress REST client with CRUD, auth, ability, and relation APIs, plus an optional `fluent-wp-client/blocks` add-on for Gutenberg workflows.

## Architecture Priorities

- Treat `WordPressClient` as the package's core integration layer. Add or harden client abilities before introducing convenience helpers that depend on them.
- Build higher-level helpers on top of proven client primitives. If a feature needs a new REST ability, implement that ability in the client first.
- Keep the package aligned with WordPress' extensibility model. Default to generic resource-oriented patterns that work for core entities, custom post types, custom taxonomies, plugin endpoints, and custom auth flows.
- Prefer `content()` and `terms()` as the public post-like and term resource API. Do not reintroduce legacy direct convenience wrappers for posts/pages/categories/tags.
- Prefer `media()`, `comments()`, `users()`, and `settings()` as the public first-class resource API in the root package. Block type discovery and block-aware content helpers belong in the dedicated `fluent-wp-client/blocks` subpath.
- Prefer Standard Schema-compatible validators for client response validation interfaces so consumers can use Zod or any other compliant schema library.
- Root package schema exports must be typed as Standard Schema (`WordPressStandardSchema`) to keep the default API validator-agnostic.
- Native Zod schema exports belong in the dedicated `fluent-wp-client/zod` entrypoint only.
- Framework-neutral agent integration helpers belong in the root package. Prefer exposing selectors, schemas, fields, and query arguments so each framework can register focused tools with its own descriptions, defaults, approval flow, and mutation guardrails.
- Core request and mutation helpers should defer validation to WordPress. When local validation is needed, use `.describe()`, `.explore()`, or generated schema artifacts in application code.
- Validate and require only the minimum data needed for a feature to work. Keep optional and custom fields extensible so projects can layer in ACF fields, meta, relations, and plugin data without fighting the package.
- Keep native posts/pages strict, but default generic custom post type reads to a flexible post-like shape because WordPress supports can remove `title`, `content`, `excerpt`, `author`, and related fields from REST responses.
- Avoid hard-coded assumptions that only fit default posts and pages. Always leave room for custom post types, taxonomies, fields, actions, and REST namespaces.
- Keep relation helpers field-type-driven and generic. For ACF and plugin integrations, prefer reusable relation factories over app-specific helper names.

## Serialization

- All terminal read methods return plain serializable DTOs by default. Returned data must survive `structuredClone()`, `JSON.stringify()`, and cross-boundary transport (SSR, RSC, `postMessage`, cache).
- No fetched DTO should contain functions, `then`, `PromiseLike`, or hidden closures. Never mutate API response objects with runtime helpers via `Object.assign` or similar.
- Runtime query helpers (`ContentItemQuery` and the shared `ExecutableQuery` base) are explicit fluent wrappers. They are not data — they are builders that resolve to data when awaited.
- Standalone block utility functions (like `parseWordPressBlocks`, `serializeWordPressBlocks`, `validateWordPressBlocks`, and generated block JSON Schema helpers) belong to the `fluent-wp-client/blocks` subpath and handle stateless transforms on already-fetched DTOs.
- Post-like collection methods (`content('posts').list()`, `content('pages').list()`, `content(resource).list()`) return plain DTO arrays.
- Post-like DTO reads keep `_embed` disabled by default; opt into embedding with `embed: true` or selective `embed: ['author', 'wp:term']` on `.item()` and `.list()`. Typed extraction helpers (`getEmbeddedAuthor`, `getEmbeddedTerms`, etc.) pull related data from embedded responses.
- Single post-like item access goes through `content(resource).item(idOrSlug)`, which returns an awaitable DTO. Pass `{ embed: true }` to include embedded data. `.getContent()` returns `{ raw, rendered, protected }` for edit context. Block parse/write helpers are added only by the `fluent-wp-client/blocks` wrapper through `.content(resource).item(...).blocks()`.
- First-class collection helpers (`media().list()`, `comments().list()`, `users().list()`) return plain DTO arrays. Single-item access goes through `.item(...)`, which is awaitable, while `settings()` remains a singleton with `.get()` / `.update()` / `.describe()`.
- When adding new resource helpers, follow the same contract: collections return plain arrays, and single-item access returns plain DTOs with optional `embed` support.

## File Structure

```
src/
  index.ts                     # Public exports barrel
  client.ts                    # WordPressClient class
  types/client.ts              # Client config and low-level request types
  schemas.ts                   # Zod schemas and inferred DTO types
  standard-schemas.ts          # Root Standard Schema exports mapped from Zod definitions
  zod.ts                       # Optional native Zod export entrypoint
  auth.ts                      # Auth types, helpers, resolvers
  blocks.ts                    # Block parse/serialize/validate helpers
  blocks-client.ts             # Block-aware client wrapper for the /blocks subpath
  blocks-entry.ts              # Public fluent-wp-client/blocks entrypoint
  blocks-zod.ts                # Public fluent-wp-client/blocks/zod entrypoint
  ai-sdk/                      # Optional Vercel AI SDK tool factories
  catalog-helpers.ts           # Framework-neutral schema, selector, and catalog helpers
  cli/                         # CLI discovery and code generation entrypoints
  abilities.ts                 # Ability methods and builder
  content-query.ts             # Raw content helper types and resolver
  zod-helpers.ts               # Runtime JSON Schema → Zod conversion helpers (used by /zod and CLI)
  types.ts                     # Re-export barrel for types/ subdirectory

  discovery.ts                 # Schema discovery cache, describeResource/Ability, explore()

  core/                        # Core infrastructure
    errors.ts                  # WordPressClientError, error kinds, factory helpers
    embedded.ts                # Embed extraction helpers (getEmbeddedAuthor, ACF helpers, etc.)
    pagination.ts              # createWordPressPaginator
    query-base.ts              # ExecutableQuery and immutable builder primitives
    validation.ts              # Standard Schema validation helpers
    params.ts                  # filterToParams, compactPayload, embed normalization
    request-overrides.ts       # Per-request non-auth header overrides
    resource-base.ts           # Shared resource classes
    transport.ts               # Runtime transport layer

  types/                       # Pure type definitions (no runtime)
    client.ts                  # WordPressClientConfig, WordPressRequestOptions, etc.
    discovery.ts               # WordPressDiscoveryCatalog, JSON Schema types
    filters.ts                 # PostsFilter, PagesFilter, MediaFilter, etc.
    payloads.ts                # WordPressWritePayload, TermWriteInput, DeleteOptions, etc.
    resources.ts               # ContentResourceClient, PaginatedResponse, FetchResult, etc.

  resources/                   # Resource classes and generic registries
    media.ts                   # MediaResource
    users.ts                   # UsersResource
    comments.ts                # CommentsResource
    settings.ts                # SettingsResource
    block-types.ts             # Block types resource (used by /blocks)
    content.ts                 # Generic post-like resource + client factory
    terms.ts                   # Generic term resource + client factory
    registry.ts                # Shared generic resource registry
    describe.ts                # Shared describe() fallback helper
  builders/                    # Fluent query/request builders
    content-item-query.ts      # ContentItemQuery builder
```

When adding new files:
- Resource-specific classes and registries go in `resources/`.
- Fluent builder/query classes go in `builders/`.
- Pure type definitions (no runtime code) go in `types/`.
- Runtime utilities shared across resources go in `core/`.
- Root `src/` files are reserved for top-level concerns (client, schemas, auth, blocks, entrypoints).

## Testing

### Philosophy

- **Integration tests only** — no unit tests. Every test runs against a real WordPress instance.
- Tests exercise the full stack: TypeScript code -> HTTP -> WordPress REST API -> response validation.
- This catches real-world issues such as serialization, pagination caps, and auth flows that mocks would miss.

### Test infrastructure

| Component | Purpose |
|---|---|
| `@wordpress/env` | Spawns a local WordPress site via the **Playground runtime** (`wp-env start --runtime=playground`, no Docker, SQLite) |
| `Vitest` | Standalone client test runner (`vitest.config.ts`) |
| `.wp-env.json` | wp-env config — PHP version, pinned `port` (8896), mu-plugin mappings, and the `plugins` array (ACF + JWT ZIP URLs). No `lifecycleScripts` (Playground does not support `wp-env run` / wp-cli) |
| `tests/wp-env/mu-plugins/` | Must-use plugins mounted into the WP site. Includes the seed, permalink/admin-email fixups, app-password bootstrap, auth-header normaliser, and the Playground auto-login disabler |
| `tests/wp-env/mu-plugins/seed-content.php` | Idempotent mu-plugin that generates all test content; runs once on `acf/init` (after ACF loads) under an atomic lock |
| `tests/wp-env/mu-plugins/set-permalinks.php` | One-time fixups: pretty permalinks + admin email (`wordpress@example.com`) |
| `tests/wp-env/mu-plugins/enable-app-passwords.php` | Enables Application Passwords over HTTP and exposes a local bootstrap REST route (`/wp-json/wp-client-test/v1/app-password`) that mints an admin Application Password named `vitest` |
| `tests/wp-env/mu-plugins/enable-jwt-auth-header.php` | Repopulates `HTTP_AUTHORIZATION` from `REDIRECT_HTTP_AUTHORIZATION` or `getallheaders()` so Basic/JWT auth reaches WP on writes |
| `tests/wp-env/mu-plugins/disable-playground-auto-login.php` | Disables the Playground runtime's per-request auto-login redirect, which otherwise loops cookieless REST requests |
| `tests/setup/global-setup.ts` | Vitest global setup — resolves the pinned port, waits for the full stack (ACF + seed + JWT + bootstrap route), fetches the app password over HTTP, creates a JWT token, and seeds a cookie+nonce auth session. No wp-cli |
| `tests/setup/env-loader.ts` | Vitest setup file — reads `.test-env.json` into `process.env` for workers |
| `tests/helpers/` | Shared test utilities for client integration coverage |

### Seed data

Test content is generated by `tests/wp-env/mu-plugins/seed-content.php`, which runs automatically once per environment on `acf/init` (so ACF field values resolve). The seed is idempotent and protected by an atomic lock, so repeated starts and concurrent first-boot requests are safe.

#### Contents

| Entity | Count | Details |
|---|---|---|
| Categories | 5 (+1 Uncategorized) | Technology, Science, Travel, Food, Health |
| Tags | 8 | featured, trending, tutorial, review, guide, news, opinion, update |
| Posts | 150 | `test-post-001` – `test-post-150` |
| Pages | 10 | About, Contact, Services, FAQ, Team, Blog, Portfolio, Testimonials, Privacy Policy, Terms of Service |
| Books (CPT) | 10 | `test-book-001` – `test-book-010`; registered by `tests/wp-env/mu-plugins/register-book-cpt.php`, `rest_base: books` |
| Artifacts (sparse CPT) | 3 | `test-artifact-001` – `test-artifact-003`; registered by `tests/wp-env/mu-plugins/register-artifact-cpt.php`, `rest_base: artifacts`, supports disabled for title/editor/excerpt/author/comments |

#### Native WordPress meta seed data

Native REST meta fields are registered by `tests/wp-env/mu-plugins/register-test-meta.php` and deterministic values are seeded by `tests/wp-env/mu-plugins/seed-content.php` once per environment.

| Entity | Slug | Meta fields set |
|---|---|---|
| Post | `test-post-001` | `test_string_meta`, `test_number_meta`, `test_array_meta` |
| Page | `about` | `test_string_meta`, `test_number_meta`, `test_array_meta` |
| Book | `test-book-001` | `test_string_meta`, `test_number_meta`, `test_array_meta`, `test_book_isbn` |

#### ACF seed data

ACF fields are seeded for a subset of content. The mu-plugin `tests/wp-env/mu-plugins/register-acf-fields.php` registers the field group on posts, pages, books, and artifacts with `show_in_rest => 1`.

The registered ACF field group includes scalar fields plus these relational field types:

- `relationship` field: `acf_related_posts`
- `post_object` field: `acf_featured_post`
- `taxonomy` field: `acf_related_genres`

| Entity | ACF fields set |
|---|---|
| Posts 001–003 | `acf_subtitle`, `acf_summary`, `acf_priority_score`, `acf_external_url`, `acf_related_posts`, `acf_featured_post` |
| Pages `about`, `contact` | `acf_subtitle`, `acf_summary`, `acf_priority_score`, `acf_external_url`, `acf_related_posts` |
| Books 001–002 | `acf_subtitle`, `acf_summary`, `acf_priority_score`, `acf_featured_post` |
| Artifacts 001–002 | `acf_subtitle`, `acf_summary`, `acf_priority_score`, `acf_external_url` |

`acf_related_genres` is registered for REST integration coverage but is not pre-seeded; tests create taxonomy terms dynamically when needed.

#### Post distribution

| Posts | Category | Tags |
|---|---|---|
| 1–30 | Technology | featured, tutorial |
| 31–60 | Science | trending, news |
| 61–90 | Travel | guide, review |
| 91–120 | Food | opinion, update |
| 121–150 | Health | featured, news |

#### Modifying seed data

1. Edit `tests/wp-env/mu-plugins/seed-content.php`.
2. Rebuild the environment: `npm run wp:clean && npm run wp:start` (`wp:clean` runs `wp-env destroy`, which is required when the seed/lock options need resetting).
3. Update test assertions to match the new seed data counts and slugs.

### Plugin requirements

- ACF (`advanced-custom-fields`) and JWT (`jwt-authentication-for-wp-rest-api`) are installed and activated by the Playground runtime from the `plugins` array in `.wp-env.json` (wordpress.org ZIP URLs). `JWT_AUTH_SECRET_KEY` is set in `.wp-env.json` for JWT endpoint tests.
- Under the Playground runtime, blueprint-activated plugins are not loaded into the very first HTTP request(s) after boot; ACF and JWT come up a request or two later. `global-setup.ts` polls until the full stack is ready, and seeding is deferred to `acf/init` so ACF field values resolve.
- WordPress ability integration tests rely on the core `wp_register_ability()` API being available in the local WordPress version. Test abilities are registered by `tests/wp-env/mu-plugins/register-test-abilities.php` and are skipped automatically when the function does not exist.
- Integration tests for extensible collection filters rely on `tests/wp-env/mu-plugins/register-test-collection-filters.php`, which registers a custom `title_search` REST collection param for posts and books.
- Custom taxonomy integration coverage uses the `genre` taxonomy registered by `tests/wp-env/mu-plugins/register-genre-taxonomy.php` (attached to posts and books, `rest_base: genre`).
- No license key is required.

### Running tests

```bash
npm run wp:start
npm test
npm run test:watch
npm run wp:stop
npm run wp:clean
```

### How to write new tests

1. **Always write integration tests**, not unit tests. Test against the real WP REST API.
2. Place REST behavior tests in `tests/integration/`.
3. Use the helpers in `tests/helpers/wp-client.ts`:
   - `createPublicClient()`
   - `createAuthClient()`
   - `createJwtAuthClient()`
   - `createCookieAuthClient()`
4. Prefer one test file per resource type.
5. Test both success paths and error paths.
6. Use exact counts and known slugs from the seed data rather than dynamic discovery.

Reference integration suites:

- `tests/integration/posts.test.ts` — `content('posts')` read and CRUD coverage, including auth variants.
- `tests/integration/pages.test.ts` — `content('pages')` read and CRUD coverage.
- `tests/integration/books.test.ts` — generic custom post type coverage through `content('books')`.
- `tests/integration/artifacts.test.ts` — sparse custom post type coverage through `content('artifacts')` and `postLikeWordPressSchema`.
- `tests/integration/categories.test.ts` — `terms('categories')` read and CRUD coverage.
- `tests/integration/tags.test.ts` — `terms('tags')` read and CRUD coverage.
- `tests/integration/comments.test.ts` — `comments()` read, CRUD, and discovery coverage.
- `tests/integration/block-types.test.ts` — `fluent-wp-client/blocks` block type discovery coverage.
- `tests/integration/media.test.ts` — `media()` reads, upload/update/delete, and discovery coverage.
- `tests/integration/users.test.ts` — `users()` reads, `/me`, CRUD, and discovery coverage.
- `tests/integration/settings.test.ts` — `settings()` reads, updates, and discovery coverage.
- `tests/integration/terms.test.ts` — generic custom taxonomy coverage through `terms('genre')`.
- `tests/integration/auth.test.ts` — JWT helper and cookie+nonce auth coverage.
- `tests/integration/cookie-auth-crud.test.ts` — full CRUD coverage across all auth methods (cookie+nonce, browser-style cookie, basic, JWT).
- `tests/integration/abilities.test.ts` — ability metadata plus GET, POST, and DELETE execution coverage.
- `tests/integration/meta.test.ts` — registered REST meta coverage across posts, pages, and books.
- `tests/integration/acf.test.ts` — ACF REST field coverage across seeded and mutated content.
- `tests/integration/blocks.test.ts` — `blocks().get()`, `blocks().set()`, and raw content workflows through the block add-on.
- `tests/integration/relations.test.ts` — embed extraction helper coverage.
- `tests/integration/serialization.test.ts` — DTO serialization safety (`structuredClone`, `JSON.stringify`, no helper leakage).
- `tests/integration/discovery.test.ts` — schema discovery, catalog exploration, and dogfooding coverage (converting discovered schemas to Zod for validation).
- `tests/integration/search.test.ts` — `searchContent()` cross-resource search coverage.
- `tests/integration/ai-sdk.test.ts` — generic AI SDK tool factory coverage for content, terms, resources, abilities, and blocks.
- `tests/integration/cli.test.ts` — CLI `schemas` command and discovery filter coverage.
- `tests/integration/cache.test.ts` — discovery cache, catalog seeding via `useCatalog()`, and query memoization coverage.
- `tests/integration/request-overrides.test.ts` — per-request header overrides, `onRequest` hooks, and rate-limiting coverage.
- `tests/integration/content-enforcement.test.ts` — `getContent()` and `getBlocks()` edit-context and field-enforcement coverage.
- `tests/integration/zod-helpers.test.ts` — `zodFromJsonSchema()` and `zodSchemasFromDescription()` runtime conversion coverage.

### What to test when adding new features

- **New client method**: Add tests to the appropriate file in `tests/integration/`. Cover returned data, required fields, pagination, slug lookup, and error cases.
- **New WP entity or resource behavior**: Add integration coverage in `tests/integration/` first.
- **New auth behavior**: Cover both working flows and failure cases with the real wp-env setup.

### wp-env lifecycle

The environment runs under the **Playground runtime** (`wp-env start --runtime=playground`), which is Docker-free and SQLite-backed. The Playground runtime does **not** support `wp-env run` (wp-cli) or `lifecycleScripts`, so all setup that used to live in `lifecycleScripts.afterStart` is now done in PHP via mapped mu-plugins. The `.wp-env.json` file configures:

- **`port`**: Pinned to `8896` so `global-setup.ts` can address the site directly (the Playground PHP server does not report a usable port via `wp-env status --json`).
- **`plugins`**: ACF and JWT, installed + activated from wordpress.org ZIP URLs by the Playground blueprint (the runtime rejects bare wordpress.org slugs).
- **`mappings`**: Mounts `tests/wp-env/mu-plugins/` into `wp-content/mu-plugins`. All fixtures (CPTs, ACF fields, abilities, seed, permalinks, app-password bootstrap, auth-header normaliser, auto-login disabler) load from there.

### Key gotchas

- Vitest `globalSetup` runs in a separate process, so `process.env` changes do not propagate to test workers. Env vars are bridged via `.test-env.json`, written by global setup and read by `tests/setup/env-loader.ts`.
- WordPress application passwords require HTTPS by default. `tests/wp-env/mu-plugins/enable-app-passwords.php` overrides this for HTTP localhost and exposes a bootstrap REST route that mints an admin Application Password (named `vitest`) for the harness to fetch.
- JWT/Basic auth relies on `tests/wp-env/mu-plugins/enable-jwt-auth-header.php` so `Authorization` headers survive local routing — under Playground the header is recovered from `getallheaders()`.
- The Playground runtime's `login` blueprint step adds a per-request auto-login that 302-redirects cookieless requests to themselves (its REST exemption checks `REST_REQUEST`, which is undefined at `init`). `tests/wp-env/mu-plugins/disable-playground-auto-login.php` neutralises it; without it Node's fetch aborts with "redirect count exceeded".
- Blueprint-activated plugins are not loaded on the very first HTTP request(s) after boot. Seeding is therefore hooked to `acf/init` (so ACF resolves field names) and `global-setup.ts` polls until the full stack is ready. The seed is protected by an atomic `add_option` lock so concurrent first-boot requests cannot double-seed.
- The WP REST API caps `per_page` at 100. Use `.listAll()` helpers for full pagination instead of setting very high `perPage` values.
- WordPress creates a default `Privacy Policy` page in draft status. The seed script detects this and publishes it to ensure 10 pages are available.
- Switching wp-env runtimes (Docker ↔ Playground) requires `wp-env destroy` first; `npm run wp:clean` runs `wp-env destroy`. The worker package's wp-env may hold port 8899, so this package pins 8896 to avoid clashes. Override the base URL with `WP_BASE_URL` when needed.

## Schema Discovery

Before writing mutations against an unfamiliar resource or ability, call `.describe()` to fetch the live JSON Schema for that endpoint, then convert it with `z.fromJSONSchema()` and validate the payload before sending it.

```ts
const desc = await wp.content('books').describe();
const schema = z.fromJSONSchema(desc.schemas.create!);
const validatedInput = schema.parse(input);
const book = await wp.content('books').create(validatedInput);
```

- `wp.content(resource).describe()` — `item`, `collection`, `create`, `update` schemas
- `wp.terms(resource).describe()` — same for taxonomies
- `wp.media().describe()` / `wp.comments().describe()` / `wp.users().describe()` / `wp.settings().describe()` — first-class resource schemas
- `wp.ability(name).describe()` — `input` and `output` schemas
- `wp.explore()` — full catalog of all resources and abilities at once

Requires an authenticated client for write schemas.

## Code Style

Follow the global coding rules already provided to the agent. Additionally:

- Standalone client source and schemas live in `src/`.
- Treat `src/client.ts` and related client primitives as the center of the package design.
- Prefer web-standard APIs so the client works across Node, Bun, Deno, and browsers.
- All public API is re-exported from `src/index.ts`.
- After any code changes, run `npm run biome:check` and fix any reported Biome issues before finalizing.

## npm Package

- `fluent-wp-client` publishes `dist/`.
- Test files, wp-env config, and contributor instruction files are repository-side assets and should not be part of the published package.
- When changing package contents, verify the published payload with `npm pack --dry-run`.

## Documentation Standards

### Format

- All documentation files must use MDX format (`.mdx` extension) with Astro Starlight frontmatter support.
- Frontmatter is optional, but best practice is to include `title`, `short_title`, and `description` so tooling can parse docs consistently.
- `sidebar` is optional and can configure `order`, `label`, `hidden`, and `badge`.
- Use relative links with `.mdx` extension for internal documentation references.

### Plugin docs conventions

- Use the `docs/` folder for all plugin documentation.
- Structure is flexible. Group docs by feature, workflow, or integration, and create subfolders when they improve discovery.
- Do not repeat the frontmatter `title` as an H1 in the body. Start with a short intro paragraph or an H2 such as `## Overview`.
- Use fenced code blocks with Expressive Code attributes. Always include a language. Add `title="..."` when the snippet maps to a terminal session or a concrete file.
- Use the Starlight `FileTree` component for folder structure documentation.

Example frontmatter:

```mdx
---
title: Configuration
description: Configure webhook behavior using methods, filters, and the registry.
sidebar:
  order: 2
---
```

See Astro Starlight Frontmatter Reference for all available options.

Plugin documentation frontmatter example:

```mdx
---
title: Plugin Documentation
short_title: Documentation
description: Guidance for writing plugin docs with structured front matter metadata.
---
```

FileTree example:

```mdx
import { FileTree } from '@astrojs/starlight/components';

<FileTree>
- src/
  - ...
</FileTree>
```
