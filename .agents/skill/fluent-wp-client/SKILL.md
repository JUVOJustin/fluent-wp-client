---
name: fluent-wp-client
description: >
  Typed WordPress REST API client for TypeScript. Use when implementing features that
  read or write WordPress content (posts, pages, media, terms, users, comments, settings),
  work with custom post types or taxonomies, authenticate against WordPress, parse
  Gutenberg blocks, hydrate post relations, call WordPress Abilities endpoints, or
  migrate from node-wpapi. Triggers: "WordPress API", "WP REST", "WordPress client",
  "fluent-wp-client", "posts API", "pages API", "media upload", "custom post type",
  "CPT", "taxonomy", "Gutenberg blocks", "WP auth", "JWT WordPress", "cookie nonce",
  "WPAPI", "node-wpapi", "WordPress abilities".
---

# fluent-wp-client

Runtime-agnostic TypeScript client for the WordPress REST API with typed CRUD, auth,
relation, ability, and block-parsing APIs. Works in Node, Bun, Deno, and browsers.

## Quick start

### 1. Install

```bash
npm install fluent-wp-client
```

### 2. Create a client

```ts
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: 'https://example.com',
});
```

### 3. Read content

```ts
const posts = await wp.content('posts').list({ perPage: 10 });
const post  = await wp.content('posts').item('hello-world');
const pages = await wp.content('pages').listAll();
```

### 4. Create content (requires auth)

```ts
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { username: 'admin', password: 'xxxx xxxx xxxx xxxx' },
});

const draft = await wp.content('posts').create({
  title: 'New post',
  content: '<p>Body content.</p>',
  status: 'draft',
});
```

## Authentication

Choose the auth strategy that fits the runtime and use case.

### Application password (Basic auth)

Server-to-server or CLI scripts.

```ts
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { username: 'admin', password: 'xxxx xxxx xxxx xxxx' },
});
```

### JWT token

User-scoped sessions with the JWT Authentication plugin.

```ts
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { token: 'eyJhbG...' },
});

// Or exchange credentials for a token first:
const { token } = await wp.loginWithJwt({
  username: 'admin',
  password: 'secret',
});

const authed = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { token },
});
```

### Pre-built Authorization header

When the header value is already constructed externally.

```ts
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  authHeader: 'Bearer eyJhbG...',
});
```

### Cookie + nonce (browser)

For WordPress front-end JavaScript where the user is already logged in.

```ts
const wp = new WordPressClient({
  baseUrl: window.location.origin,
  auth: {
    nonce: window.wpApiSettings.nonce,
    credentials: 'include',
  },
});

const me = await wp.users().me();
```

### Request-aware signing (HMAC / custom)

For auth schemes that sign each request individually.

```ts
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  authHeaders: ({ method, url, body }) => ({
    Authorization: computeHmacSignature({ method, url: url.toString(), body }),
  }),
});
```

### Per-request auth override

Override client-level auth for a single call.

```ts
const { data } = await wp.request({
  endpoint: '/wp-json/wp/v2/posts',
  auth: { token: 'different-token' },
});
```

## Core resource APIs

### Posts

```ts
// Read
const posts     = await wp.content('posts').list({ categories: [3], perPage: 20 });
const allPosts  = await wp.content('posts').listAll({ status: 'publish' });
const paginated = await wp.content('posts').listPaginated({ page: 2, perPage: 10 });
const post      = await wp.content('posts').item(42);
const bySlug    = await wp.content('posts').item('hello-world');

// Create, update, delete
const created = await wp.content('posts').create({ title: 'Title', status: 'draft' });
const updated = await wp.content('posts').update(created.id, { status: 'publish' });
await wp.content('posts').delete(created.id, { force: true });
```

### Pages

```ts
const pages    = await wp.content('pages').list({ perPage: 50 });
const allPages = await wp.content('pages').listAll();
const page     = await wp.content('pages').item(10);
const bySlug   = await wp.content('pages').item('about');

const created = await wp.content('pages').create({ title: 'About us', status: 'draft' });
await wp.content('pages').update(created.id, { status: 'publish' });
await wp.content('pages').delete(created.id, { force: true });
```

### Categories and tags

```ts
const categories = wp.terms('categories');
const tags = wp.terms('tags');

const cats = await categories.listAll();
const cat  = await categories.item('technology');

const created = await categories.create({ name: 'News' });
await categories.update(created.id, { description: 'Latest news' });
await categories.delete(created.id, { force: true });

// Tags follow the same pattern
const allTags = await tags.listAll();
const tag = await tags.create({ name: 'featured' });
```

### Comments

```ts
const comments = await wp.comments().list({ post: 42 });

const comment = await wp.comments().create({
  post: 42,
  content: 'Great article!',
  status: 'approve',
});

await wp.comments().update(comment.id, { content: 'Updated comment.' });
await wp.comments().delete(comment.id, { force: true });
```

### Media

```ts
const items = await wp.media().list({ mediaType: 'image' });
const item  = await wp.media().item(55);
const url   = wp.media().getImageUrl(item, 'medium');

// Binary upload
const media = await wp.media().upload({
  file: imageBlob,
  filename: 'cover.jpg',
  mimeType: 'image/jpeg',
  title: 'Cover image',
  alt_text: 'A book cover',
});

await wp.media().update(media.id, { caption: 'New caption' });
await wp.media().delete(media.id, { force: true });
```

### Users

```ts
const users = await wp.users().list({ roles: ['author'] });
const user  = await wp.users().item(1);
const me    = await wp.users().me();

const created = await wp.users().create({
  username: 'newauthor',
  email: 'author@example.com',
  password: 'securepass',
  roles: ['author'],
});

await wp.users().update(created.id, { first_name: 'Jane' });
await wp.users().delete(created.id, { reassign: 1, force: true });
```

### Settings

```ts
const settings = await wp.settings().get();
await wp.settings().update({ title: 'New Site Title' });
```

## Custom post types and taxonomies

Use `content(resource)` and `terms(resource)` for any CPT or custom taxonomy
registered with a `rest_base`.

```ts
// CPT with rest_base: 'books'
const books = wp.content('books');

const list      = await books.list({ perPage: 20 });
const allBooks  = await books.listAll();
const paged     = await books.listPaginated({ page: 2, perPage: 10 });
const book      = await books.item(7);
const bySlug    = await books.item('my-book');
const created   = await books.create({ title: 'New Book', status: 'draft' });
await books.update(created.id, { status: 'publish' });
await books.delete(created.id, { force: true });
```

```ts
// Custom taxonomy with rest_base: 'genre'
const genres = wp.terms('genre');

const list    = await genres.list({ perPage: 100 });
const all     = await genres.listAll();
const genre   = await genres.item('sci-fi');
const created = await genres.create({ name: 'Science Fiction' });
await genres.update(created.id, { name: 'Sci-Fi' });
await genres.delete(created.id, { force: true });
```

### CPT typing

```ts
import type { WordPressCustomPost } from 'fluent-wp-client';

type Book = WordPressCustomPost<{
  type: 'book';
  acf?: { acf_subtitle?: string; acf_summary?: string };
}>;

const books = await wp.content<Book>('books').list();
```

For full CPT/taxonomy patterns and namespace routing, read
[references/custom-endpoints.mdx](references/custom-endpoints.mdx).

## Gutenberg block parsing

Parse serialized block markup into structured block trees.

```ts
// From a single post/page query
const blocks = await wp.content('posts').item('hello-world').getBlocks();
const pageBlocks = await wp.content('pages').item('about').getBlocks();

// From list records
const posts = await wp.content('posts').list({ perPage: 5 });
const firstBlocks = await posts[0].getBlocks();

// Raw + rendered content together
const content = await wp.content('posts').item('hello-world').getContent();
// content.raw, content.rendered, content.protected

// Parse raw content directly
import { parseWordPressBlocks } from 'fluent-wp-client';
const parsed = await parseWordPressBlocks(content.raw);
```

`getBlocks()` requires `context=edit` (authenticated with edit capabilities).

For custom parser configuration and CPT block parsing, read
[references/gutenberg-content.mdx](references/gutenberg-content.mdx).

## Embed and extraction

Request embedded data with `embed: true` or selective `embed: ['author', 'wp:term']`, then use typed extraction helpers.

```ts
import {
  getEmbeddedAuthor,
  getEmbeddedTerms,
  getEmbeddedFeaturedMedia,
  getEmbeddedParent,
  getEmbeddableLinkKeys,
} from 'fluent-wp-client';

const post = await wp.content('posts').item('hello-world', { embed: true });

getEmbeddedAuthor(post);              // WordPressAuthor | null
getEmbeddedTerms(post, 'category');   // WordPressCategory[]
getEmbeddedTerms(post, 'post_tag');   // WordPressTag[]
getEmbeddedFeaturedMedia(post);       // WordPressMedia | null
getEmbeddedParent(post);              // WordPressPostLike | null

// Discover embeddable keys
const keys = getEmbeddableLinkKeys(post); // ['author', 'wp:term', ...]
```

Embed keys: `author`, `wp:term`, `wp:featuredmedia`, `up`, `replies`, `acf:post`, `acf:term`.

## Schema Discovery

Before writing mutations against an unfamiliar resource or ability, call `.describe()` to fetch its live JSON Schema, then convert with `z.fromJSONSchema()` and pass to `create()`, `update()`, or `.inputSchema()`.

- `wp.content(resource).describe()` — `create`, `update`, `item` schemas
- `wp.terms(resource).describe()` — same for taxonomies
- `wp.ability(name).describe()` — `input` and `output` schemas
- `wp.explore()` — full catalog of all resources and abilities at once

See `docs/schema-discovery.mdx` for examples.

## WordPress Abilities API

Inspect and execute server-registered abilities at `/wp-json/wp-abilities/v1`.

```ts
// Metadata
const abilities  = await wp.getAbilities();
const ability    = await wp.getAbility('myplugin/sync-data');
const categories = await wp.getAbilityCategories();

// Direct execution (pick the method matching the ability annotations)
const result = await wp.executeGetAbility<{ title: string }>('test/get-site-title');
const posted = await wp.executeRunAbility('test/update-option', { value: 'new' });
const deleted = await wp.executeDeleteAbility('test/delete-option');

// Fluent builder with local schema validation
import { z } from 'zod';

const sync = wp
  .ability<{ mode: string }, { synced: number }>('myplugin/sync-data')
  .inputSchema(z.object({ mode: z.enum(['full', 'delta']) }))
  .outputSchema(z.object({ synced: z.number() }));

const output = await sync.run({ mode: 'full' });
```

For the complete abilities API surface, read
[references/abilities.mdx](references/abilities.mdx).

## Unified resource builders

The 3.0 API centers on `content(resource)`, `terms(resource)`, and first-class resource clients.

```ts
// Posts and pages
const posts = await wp.content('posts').list({ perPage: 10, page: 1 });
const post = await wp.content('posts').item('hello-world');

const created = await wp.content('posts').create({ title: 'New', status: 'draft' });
await wp.content('posts').update(created.id, { title: 'Updated' });
await wp.content('posts').delete(created.id, { force: true });

// Custom post types and taxonomies
const books = await wp.content('books').list({ perPage: 5 });
const genres = await wp.terms('genre').list({ perPage: 50 });

// First-class resources
const media = await wp.media().list({ perPage: 20 });
const comments = await wp.comments().list({ post: 42 });

// Custom/plugin endpoints
const { data } = await wp.request<{ author: { id: number; name: string } }>({
  endpoint: '/wp-json/my-plugin/v1/authors/7',
  method: 'GET',
});
```

Use `request()` whenever the endpoint lives outside the standard `wp/v2` resource families.

## Meta and ACF fields

### Native WordPress meta

```ts
const post = await wp.content('posts').create({
  title: 'Post with meta',
  status: 'draft',
  meta: {
    custom_field: 'value',
    numeric_field: 42,
    array_field: ['a', 'b', 'c'],
  },
});
```

### ACF fields

```ts
const post = await wp.content('posts').create({
  title: 'Post with ACF',
  status: 'draft',
  acf: {
    subtitle: 'My subtitle',
    priority_score: 85,
    related_posts: [10, 20],
  },
});
```

Both `meta` and `acf` are extensible `Record<string, unknown>` fields.
All Zod schemas use `.passthrough()` so custom plugin fields pass through.

## Response validation

WordPress validates request payloads upstream. When local validation is needed, validate in application code with Zod or discovered JSON Schemas.

```ts
import { z } from 'zod';

// Validate a mutation response in app code
const postSchema = z.object({ id: z.number(), slug: z.string(), status: z.string() });
const created = postSchema.parse(
  await wp.content('posts').create({ title: 'Validated', status: 'draft' })
);

// Validate CPT responses
const bookSchema = z.object({
  id: z.number(),
  slug: z.string(),
  type: z.literal('book'),
});

const rawBook = await wp.content('books').item('typed-book');
const book = bookSchema.parse(rawBook);
```

## Low-level transport

Use `request()` for full control over method, body, headers, and response metadata.

```ts
const { data, response } = await wp.request<{ synced: boolean }>({
  endpoint: '/wp-json/my-plugin/v1/sync',
  method: 'POST',
  body: { mode: 'full' },
});

// High-level pagination stays on the resource clients
const posts = await wp.content('posts').listPaginated({ perPage: 10, page: 1 });
// posts.data, posts.total, posts.totalPages
```

## Pagination

- WordPress caps `per_page` at 100.
- `.list()` methods return one page of results.
- `.listAll()` methods auto-paginate through every page internally.
- `.listPaginated()` methods return `{ data, total, totalPages, page, perPage }`.

```ts
// All posts (auto-paginates internally)
const all = await wp.content('posts').listAll();

// One page with metadata
const page = await wp.content('posts').listPaginated({ page: 3, perPage: 25 });
console.log(`Page ${page.page} of ${page.totalPages} (${page.total} total)`);
```

## Error handling

All runtime failures throw `WordPressClientError` (or a subclass). Use `instanceof` to narrow to specific error types:

```ts
import { WordPressClientError, WordPressHttpError } from 'fluent-wp-client';

try {
  await wp.content('posts').item(999999);
} catch (error) {
  if (error instanceof WordPressHttpError) {
    console.log(error.status);      // HTTP status (e.g. 404)
    console.log(error.wpCode);      // WP error code (e.g. 'rest_post_invalid_id')
    console.log(error.wpMessage);   // WP error message
    console.log(error.responseBody); // Raw response payload
  }
  
  // Catch-all for any client error
  if (error instanceof WordPressClientError) {
    console.log(error.kind);        // e.g. 'WP_API_ERROR', 'AUTH_ERROR', 'NETWORK_ERROR'
    console.log(error.retryable);   // Can the caller retry?
  }
}
```

## Exported Zod schemas

Reuse or extend the built-in schemas for your own validation:

`postSchema`, `pageSchema`, `mediaSchema`, `categorySchema`, `authorSchema`,
`commentSchema`, `settingsSchema`, `abilitySchema`, `abilityCategorySchema`,
`abilityAnnotationsSchema`, `baseWordPressSchema`, `contentWordPressSchema`,
`embeddedMediaSchema`, `wordPressErrorSchema`, `postWriteBaseSchema`,
`updatePostFieldsSchema`.

All schemas use `.passthrough()` so custom fields (ACF, meta, plugin data) survive parsing.

## Exported types

### Entity types
`WordPressPost`, `WordPressPage`, `WordPressMedia`, `WordPressCategory`, `WordPressTag`,
`WordPressAuthor`, `WordPressComment`, `WordPressSettings`, `WordPressAbility`,
`WordPressAbilityCategory`, `WordPressCustomPost<TExtra>`, `WordPressPostBase`,
`WordPressBase`, `WordPressContent`

### Auth types
`BasicAuthCredentials`, `JwtAuthCredentials`, `HeaderAuthCredentials`,
`CookieNonceAuthCredentials`, `WordPressAuthConfig`, `WordPressAuthHeaders`,
`WordPressAuthHeadersProvider`, `ResolvableWordPressAuth<TContext>`

### Filter types
`PostsFilter`, `PagesFilter`, `MediaFilter`, `CategoriesFilter`, `TagsFilter`,
`UsersFilter`, `CommentsFilter`, `PaginationParams`

### Operation types
`PaginatedResponse<T>`, `FetchResult<T>`, `DeleteOptions`, `UserDeleteOptions`,
`WordPressDeleteResult`, `WordPressWritePayload`, `TermWriteInput`, `UserWriteInput`,
`ContentResourceClient<T, TCreate, TUpdate>`, `TermsResourceClient<T, TCreate, TUpdate>`

### Block types
`WordPressParsedBlock`, `WordPressBlockParser`, `WordPressContentRecord<T>`

## Reference docs

Consult these when deeper guidance is needed for a specific topic:

| Reference | When to read |
|---|---|
| [references/usage.mdx](references/usage.mdx) | Full method reference, all API styles side by side, CRUD walkthrough, filter and pagination detail |
| [references/gutenberg-content.mdx](references/gutenberg-content.mdx) | Rendered vs raw content, block parsing workflows, custom parser setup, CPT block parsing |
| [references/custom-endpoints.mdx](references/custom-endpoints.mdx) | CPT/taxonomy patterns, low-level custom endpoint requests, and per-request headers |
| [references/abilities.mdx](references/abilities.mdx) | Ability metadata, direct execution helpers, fluent builder with schemas, exported ability schemas |
| [references/schema-discovery.mdx](references/schema-discovery.mdx) | `.describe()`, `explore()`, `z.fromJSONSchema()` integration and examples |
