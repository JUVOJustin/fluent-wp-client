# Custom endpoints

This guide explains how to work with custom post types, custom taxonomies, and plugin REST namespaces.

## Pick the right API style

- Use `content('resource')` for custom post types in `wp/v2`.
- Use `terms('resource')` for custom taxonomies in `wp/v2`.
- Use `namespace(...).route(...)` for plugin/custom namespaces.
- Use `request(...)` when you need full transport control.

## Custom post types (CPT)

Assume a CPT with `rest_base: 'books'`.

```ts
const books = wp.content('books');

const list = await books.list({ perPage: 20, page: 1 });
const bySlug = await books.getBySlug('my-book');
```

### CPT CRUD

```ts
const books = wp.content('books');

const created = await books.create({
  title: 'Book title',
  status: 'draft',
});

await books.update(created.id, {
  status: 'publish',
});

await books.delete(created.id, { force: true });
```

### CPT with response validation

```ts
import { z } from 'zod';

const bookSchema = z.object({
  id: z.number(),
  slug: z.string(),
  status: z.string(),
  type: z.literal('book'),
});

const books = wp.content('books', bookSchema);
const created = await books.create({ title: 'Typed book', status: 'draft' });
```

## Custom taxonomies

Assume a taxonomy with `rest_base: 'genre'`.

```ts
const genres = wp.terms('genre');

const list = await genres.list({ perPage: 100 });
const bySlug = await genres.getBySlug('sci-fi');
```

### Custom taxonomy CRUD

```ts
const genres = wp.terms('genre');

const created = await genres.create({ name: 'Science Fiction' });
await genres.update(created.id, { name: 'Sci-Fi' });
await genres.delete(created.id, { force: true });
```

## Plugin/custom namespace routes

For endpoints outside `wp/v2`, use namespace-scoped chains:

```ts
const syncResult = await wp
  .namespace('my-plugin/v1')
  .route('sync')
  .param('mode', 'full')
  .get();
```

You can also create/update/delete in custom namespaces:

```ts
const inventory = wp.namespace('inventory/v1').route('items');

const created = await inventory.create({ sku: 'abc-123', stock: 20 });
await inventory.id((created as { id: number }).id).update({ stock: 18 });
await inventory.id((created as { id: number }).id).delete();
```

## node-wpapi `registerRoute` compatibility

```ts
const authorRoute = wp.registerRoute('my-plugin/v1', '/authors/(?P<id>)');

const url = authorRoute().id(7).toString();
const author = await authorRoute().id(7).get();
```

## Low-level custom endpoint requests

Use `request()` if you need direct access to headers/response metadata.

```ts
const { data, response } = await wp.request({
  endpoint: '/wp-json/my-plugin/v1/sync',
  method: 'POST',
  body: { mode: 'delta' },
});

if (!response.ok) {
  throw new Error(`Sync failed: ${response.status}`);
}
```

## Auth for custom endpoints

Choose the same auth approach as core endpoints:

- Basic auth for server-to-server/admin tasks
- JWT auth for user-scoped sessions
- Cookie + nonce for browser-front-end authenticated calls
- `authHeaders` for signature-based/custom auth schemes

If a custom endpoint requires per-request auth behavior, set auth at request-chain level:

```ts
const result = await wp
  .namespace('my-plugin/v1')
  .route('secure-sync')
  .auth({ token: 'jwt-token' })
  .get();
```

## Error handling

- API failures throw `WordPressApiError` with status, code, and payload details.
- Validate only the fields your feature actually needs.
- Prefer schema validation for writes so custom endpoint regressions fail fast.
