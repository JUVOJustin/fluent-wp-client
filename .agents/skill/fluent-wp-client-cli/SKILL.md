---
name: fluent-wp-client-cli
description: >
  CLI tool for the fluent-wp-client package that discovers WordPress REST API schemas
  and generates TypeScript/Zod/JSON Schema code artifacts. Use this skill whenever
  a user wants to run the CLI, generate schemas from a WordPress site, produce TypeScript
  types or Zod validators for WordPress resources, set up build-time schema generation,
  or automate schema discovery in CI. Triggers: "fluent-wp-client cli",
  "generate WordPress schemas", "wp schemas command", "npx fluent-wp-client",
  "generate Zod from WordPress", "WordPress TypeScript types codegen", "schema generation
  from WordPress", "wp-schemas.ts", "WordPress REST codegen", "build-time WordPress types".
---

# fluent-wp-client CLI

The `fluent-wp-client` CLI connects to a live WordPress site, discovers its REST API
schemas, and generates typed code artifacts — Zod validators, JSON Schema, or TypeScript
types — for use in downstream apps, validators, and AI tooling.

## Command

```bash
npx fluent-wp-client schemas   # Zod, JSON Schema, or both
npx fluent-wp-client --help
```

## `schemas` command

Generates normalized schemas for every discovered WordPress resource (post types,
taxonomies). Output can be:

- **`zod`** (default) — TypeScript module with JSON Schema literals, `z.fromJSONSchema()`
  validators, and inferred TS types. Best for TypeScript/JavaScript projects.
- **`json-schema`** — JSON document keyed by REST base. Portable across any language.
- **`both`** — Emits both artifacts in one run.

### Basic usage

```bash title="Schema generation"
# Zod output (default)
npx fluent-wp-client schemas --url https://example.com

# JSON Schema only
npx fluent-wp-client schemas --url https://example.com --format json-schema

# Both formats with custom filenames
npx fluent-wp-client schemas --url https://example.com --format both \
  --zod-out src/lib/wp-schemas.ts \
  --json-out src/lib/wp-schemas.json
```

### Generated output example

For each resource the Zod output produces:

```ts title="wp-schemas.ts (generated)"
// JSON Schema literal — portable, usable outside Zod
export const wpBookJsonSchema = { type: "object", properties: { ... } } as const;

// Zod schema built from the JSON Schema
export const wpBookSchema = z.fromJSONSchema(wpBookJsonSchema);

// Inferred TypeScript type
export type WPBook = z.infer<typeof wpBookSchema>;
```

## Authentication

Authenticated discovery is required to access write schemas (create/update). Pass one
auth flag — do not combine multiple auth modes in the same invocation.

```bash title="Auth examples"
# Application password
npx fluent-wp-client schemas --url https://example.com \
  --username admin \
  --password "xxxx xxxx xxxx xxxx"

# JWT token
npx fluent-wp-client schemas --url https://example.com \
  --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Pre-built Authorization header
npx fluent-wp-client schemas --url https://example.com \
  --auth-header "Bearer eyJhbG..."
```

| Flag | Auth mode |
|---|---|
| `--username` + `--password` | Application password (Basic auth) |
| `--token` | JWT bearer token |
| `--auth-header` | Prebuilt header value |

## Resource filtering

Use `--include` or `--exclude` to limit which resources are generated. Values are
comma-separated slugs or REST bases.

```bash title="Filtering resources"
# Only generate posts and books
npx fluent-wp-client schemas --url https://example.com --include posts,books

# Generate everything except users and settings
npx fluent-wp-client schemas --url https://example.com --exclude users,settings

# Combine: include posts,books,genre then remove posts
npx fluent-wp-client schemas --url https://example.com --include posts,books,genre --exclude posts
```

## Interactive mode

Omit `--url` to enter interactive mode. The CLI prompts for the site URL and
authentication method.

```bash title="Interactive mode"
npx fluent-wp-client schemas
```

## All flags reference

| Flag | Default | Description |
|---|---|---|
| `--url <url>` | — (prompts) | WordPress site URL |
| `--format <format>` | `zod` | `zod`, `json-schema`, or `both` |
| `--out <file>` | `wp-schemas.ts` | Output file for `zod` format |
| `--zod-out <file>` | `wp-schemas.ts` | Zod module output path |
| `--json-out <file>` | `wp-schemas.json` | JSON Schema output path |
| `--username <name>` | — | Application password username |
| `--password <value>` | — | Application password |
| `--token <value>` | — | JWT bearer token |
| `--auth-header <value>` | — | Prebuilt Authorization header value |
| `--include <list>` | all | Comma-separated resource slugs/REST bases to include |
| `--exclude <list>` | none | Comma-separated resource slugs/REST bases to exclude |

## CI / build integration

For deterministic builds, pin the URL, auth, and output paths as flags so the CLI
runs non-interactively. The command exits with a non-zero code on failure.

```bash title="CI example"
npx fluent-wp-client schemas \
  --url "$WP_URL" \
  --username "$WP_USER" \
  --password "$WP_APP_PASSWORD" \
  --format both \
  --zod-out src/lib/wp-schemas.ts \
  --json-out src/lib/wp-schemas.json
```

## Using generated schemas with the client

After generating, import and pass schemas to the `fluent-wp-client` runtime client to
validate read/write responses.

```ts title="Using generated schemas"
import { WordPressClient } from 'fluent-wp-client';
import { wpBookSchema } from './wp-schemas';

const wp = new WordPressClient({ baseUrl: 'https://example.com' });

// Pass as a response schema for CRUD operations
const book = await wp.content('books').item(7);
const parsed = wpBookSchema.parse(book);
```

## CLI vs runtime discovery

| | CLI (build-time) | Runtime `.describe()` / `.explore()` |
|---|---|---|
| When schemas are fetched | During build / CI run | At application runtime |
| Output | Generated `.ts` / `.json` files | Live API response objects |
| Best for | Static typing, Zod validators, AI tools | Dynamic sites, plugin discovery |
| Auth | Flags passed to CLI | `WordPressClient` configuration |

For runtime schema discovery, see the `schema-discovery.mdx` reference in the
`fluent-wp-client` skill.
