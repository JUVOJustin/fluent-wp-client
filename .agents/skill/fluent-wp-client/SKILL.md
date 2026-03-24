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
const posts = await wp.getPosts({ perPage: 10 });
const post  = await wp.getPostBySlug('hello-world');
const pages = await wp.getAllPages();
```

### 4. Create content (requires auth)

```ts
const wp = new WordPressClient({
  baseUrl: 'https://example.com',
  auth: { username: 'admin', password: 'xxxx xxxx xxxx xxxx' },
});

const draft = await wp.createPost({
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

const me = await wp.getCurrentUser();
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
const posts     = await wp.getPosts({ categories: [3], perPage: 20 });
const allPosts  = await wp.getAllPosts({ status: 'publish' });
const paginated = await wp.getPostsPaginated({ page: 2, perPage: 10 });
const post      = await wp.getPost(42);
const bySlug    = await wp.getPostBySlug('hello-world');

// Create, update, delete
const created = await wp.createPost({ title: 'Title', status: 'draft' });
const updated = await wp.updatePost(created.id, { status: 'publish' });
await wp.deletePost(created.id, { force: true });
```

### Pages

```ts
const pages    = await wp.getPages({ perPage: 50 });
const allPages = await wp.getAllPages();
const page     = await wp.getPage(10);
const bySlug   = await wp.getPageBySlug('about');

const created = await wp.createPage({ title: 'About us', status: 'draft' });
await wp.updatePage(created.id, { status: 'publish' });
await wp.deletePage(created.id, { force: true });
```

### Categories and tags

```ts
const cats = await wp.getAllCategories();
const cat  = await wp.getCategoryBySlug('technology');

const created = await wp.createCategory({ name: 'News' });
await wp.updateCategory(created.id, { description: 'Latest news' });
await wp.deleteCategory(created.id, { force: true });

// Tags follow the same pattern
const tags = await wp.getAllTags();
const tag  = await wp.createTag({ name: 'featured' });
```

### Comments

```ts
const comments = await wp.getComments({ post: 42 });

const comment = await wp.createComment({
  post: 42,
  content: 'Great article!',
  status: 'approve',
});

await wp.updateComment(comment.id, { content: 'Updated comment.' });
await wp.deleteComment(comment.id, { force: true });
```

### Media

```ts
const items = await wp.getMedia({ mediaType: 'image' });
const item  = await wp.getMediaItem(55);
const url   = wp.getImageUrl(item, 'medium');

// Binary upload
const media = await wp.uploadMedia({
  file: imageBlob,
  filename: 'cover.jpg',
  mimeType: 'image/jpeg',
  title: 'Cover image',
  alt_text: 'A book cover',
});

await wp.updateMedia(media.id, { caption: 'New caption' });
await wp.deleteMedia(media.id, { force: true });
```

### Users

```ts
const users = await wp.getUsers({ roles: ['author'] });
const user  = await wp.getUser(1);
const me    = await wp.getCurrentUser();

const created = await wp.createUser({
  username: 'newauthor',
  email: 'author@example.com',
  password: 'securepass',
  roles: ['author'],
});

await wp.updateUser(created.id, { first_name: 'Jane' });
await wp.deleteUser(created.id, { reassign: 1, force: true });
```

### Settings

```ts
const settings = await wp.getSettings();
await wp.updateSettings({ title: 'New Site Title' });
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
const book      = await books.getById(7);
const bySlug    = await books.getBySlug('my-book');
const created   = await books.create({ title: 'New Book', status: 'draft' });
await books.update(created.id, { status: 'publish' });
await books.delete(created.id, { force: true });
```

```ts
// Custom taxonomy with rest_base: 'genre'
const genres = wp.terms('genre');

const list    = await genres.list({ perPage: 100 });
const all     = await genres.listAll();
const genre   = await genres.getBySlug('sci-fi');
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
const blocks = await wp.getPostBySlug('hello-world').getBlocks();
const pageBlocks = await wp.getPageBySlug('about').getBlocks();

// From list records
const posts = await wp.getPosts({ perPage: 5 });
const firstBlocks = await posts[0].getBlocks();

// Raw + rendered content together
const content = await wp.getPostBySlug('hello-world').getContent();
// content.raw, content.rendered, content.protected

// Parse raw content directly
import { parseWordPressBlocks } from 'fluent-wp-client';
const parsed = await parseWordPressBlocks(content.raw);
```

`getBlocks()` requires `context=edit` (authenticated with edit capabilities).

For custom parser configuration and CPT block parsing, read
[references/gutenberg-content.mdx](references/gutenberg-content.mdx).

## Post relations

Hydrate related entities in a single fluent call.

```ts
// Fluent chain
const result = await wp
  .post('hello-world')
  .with('author', 'categories', 'tags', 'featuredMedia')
  .get();

result.related.author;        // WordPressAuthor | null
result.related.categories;    // WordPressCategory[]
result.related.tags;          // WordPressTag[]
result.related.featuredMedia; // WordPressMedia | null

// Shorthand
const post = await wp.getPostWithRelations(42, 'author', 'terms');
post.related.terms; // { categories: [...], tags: [...] }
```

Available relations: `author`, `categories`, `tags`, `terms`, `featuredMedia`.

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

## WPAPI-compatible fluent builder

Drop-in fluent chain syntax compatible with `node-wpapi`.

```ts
// Read
const posts = await wp.posts().perPage(10).page(1).embed().get();
const post  = await wp.posts().slug('hello-world').get();
const post2 = await wp.posts().id(42).get();

// Thenable shorthand (await calls .get() implicitly)
const post3 = await wp.posts().slug('hello-world');

// CRUD
const created = await wp.posts().create({ title: 'New', status: 'draft' });
await wp.posts().id(created.id).update({ title: 'Updated' });
await wp.posts().id(created.id).delete({ force: true });

// Custom namespace
const books = await wp.namespace('wp/v2').route('books').perPage(5).get();

// Route registration (node-wpapi compatible)
const authorRoute = wp.registerRoute('my-plugin/v1', '/authors/(?P<id>)');
const author = await authorRoute().id(7).get();

// URL inspection
const url = wp.posts().perPage(5).page(2).toString();
```

All chain starters: `posts()`, `pages()`, `media()`, `categories()`, `tags()`,
`users()`, `comments()`, `settings()`, `types()`, `taxonomies()`, `statuses()`,
`search()`, `blocks()`.

For a full migration mapping from node-wpapi, read
[references/migration-from-node-wpapi.mdx](references/migration-from-node-wpapi.mdx).

## Meta and ACF fields

### Native WordPress meta

```ts
const post = await wp.createPost({
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
const post = await wp.createPost({
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

Mutation helpers accept any Standard Schema-compatible validator (Zod, Valibot, ArkType).

```ts
import { z } from 'zod';

// Validate mutation response
const created = await wp.createPost(
  { title: 'Validated', status: 'draft' },
  z.object({ id: z.number(), slug: z.string(), status: z.string() }),
);

// Validate CPT responses
const bookSchema = z.object({
  id: z.number(),
  slug: z.string(),
  type: z.literal('book'),
});

const books = wp.content('books', bookSchema);
const book = await books.create({ title: 'Typed Book', status: 'draft' });
```

## Low-level transport

Use `request()` for full control over method, body, headers, and response metadata.

```ts
const { data, response } = await wp.request<{ synced: boolean }>({
  endpoint: '/wp-json/my-plugin/v1/sync',
  method: 'POST',
  body: { mode: 'full' },
});

// Simple typed GET
const info = await wp.fetchAPI<{ version: string }>('/wp-json/wp/v2');

// GET with pagination metadata
const result = await wp.fetchAPIPaginated<WordPressPost>('/wp-json/wp/v2/posts', {
  per_page: '10',
});
// result.data, result.total, result.totalPages
```

## Pagination

- WordPress caps `per_page` at 100.
- `get*()` methods return one page of results.
- `getAll*()` methods auto-paginate through every page internally.
- `get*Paginated()` methods return `{ data, total, totalPages, page, perPage }`.

```ts
// All posts (auto-paginates internally)
const all = await wp.getAllPosts();

// One page with metadata
const page = await wp.getPostsPaginated({ page: 3, perPage: 25 });
console.log(`Page ${page.page} of ${page.totalPages} (${page.total} total)`);
```

## Error handling

```ts
import { WordPressApiError, WordPressSchemaValidationError } from 'fluent-wp-client';

try {
  await wp.getPost(999999);
} catch (error) {
  if (error instanceof WordPressApiError) {
    console.log(error.status);       // HTTP status (e.g. 404)
    console.log(error.code);         // WP error code (e.g. 'rest_post_invalid_id')
    console.log(error.responseBody); // Raw response payload
  }
  if (error instanceof WordPressSchemaValidationError) {
    console.log(error.issues);       // [{ path: [...], message: '...' }]
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
`WordPressParsedBlock`, `WordPressBlockParser`, `WordPressContentRecord<T>`,
`WordPressContentQuery<T>`

## Reference docs

Consult these when deeper guidance is needed for a specific topic:

| Reference | When to read |
|---|---|
| [references/usage.mdx](references/usage.mdx) | Full method reference, all API styles side by side, CRUD walkthrough, filter and pagination detail |
| [references/gutenberg-content.mdx](references/gutenberg-content.mdx) | Rendered vs raw content, block parsing workflows, custom parser setup, CPT block parsing |
| [references/custom-endpoints.mdx](references/custom-endpoints.mdx) | CPT/taxonomy patterns, namespace routing, registerRoute, low-level requests, per-request auth |
| [references/abilities.mdx](references/abilities.mdx) | Ability metadata, direct execution helpers, fluent builder with schemas, exported ability schemas |
| [references/migration-from-node-wpapi.mdx](references/migration-from-node-wpapi.mdx) | Side-by-side mapping from node-wpapi, auth migration, behavioral differences |
