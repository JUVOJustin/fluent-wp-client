# Usage

This is the primary developer guide for `fluent-wp-client`.

Canonical repository: `git@github.com:JUVOJustin/fluent-wp-client.git`

It covers:

- all main client method groups
- complete CRUD patterns
- WordPress abilities metadata and execution
- WPAPI-compatible fluent syntax
- validation, auth, pagination, and error handling

## Install

```bash
npm install fluent-wp-client
```

## Development Testing

This repository owns the WordPress integration suite for the client.

```bash
npm run wp:start
npm test
npm run wp:stop
```

## Create a client

```ts
import { WordPressClient } from 'fluent-wp-client';

const wp = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
});
```

## Authentication patterns

```ts
import { WordPressClient } from 'fluent-wp-client';

// Basic auth (application password)
const basicClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: { username: 'admin', password: 'app-password' },
});

// JWT auth
const jwtClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: { token: 'jwt-token' },
});

// Prebuilt Authorization header
const headerClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  authHeader: 'Bearer jwt-token',
});

// Cookie + nonce browser auth
const cookieNonceClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  auth: { nonce: 'wp-rest-nonce', credentials: 'include' },
});

// Request-aware signing
const signedClient = new WordPressClient({
  baseUrl: 'https://your-wordpress-site.com',
  authHeaders: ({ method, url, body }) => ({
    Authorization: createSignedAuthHeader({ method, url: url.toString(), body }),
  }),
});
```

## API styles

The client exposes five complementary styles.

### 1) Typed resource helpers (recommended default)

```ts
const posts = await wp.getPosts({ perPage: 10, page: 1 });
const post = await wp.getPostBySlug('hello-world');
```

### 2) Generic resource helpers for CPTs/taxonomies

```ts
const books = await wp.getContentCollection('books', { perPage: 20 });
const genres = await wp.getTermCollection('genre', { perPage: 100 });
```

### 3) WPAPI-compatible fluent builder

```ts
const chainPosts = await wp.posts().perPage(10).page(1).embed().get();
const chainPost = await wp.posts().slug('hello-world').get();
```

### 4) Low-level request transport

```ts
const { data, response } = await wp.request({
  endpoint: '/wp-json/my-plugin/v1/sync',
  method: 'POST',
  body: { mode: 'full' },
});
```

### 5) WordPress abilities

```ts
const definitions = await wp.getAbilities();
const siteTitle = await wp.executeGetAbility<{ title: string }>('test/get-site-title');

const processed = await wp
  .ability<{ name: string }, { processed: boolean }>('test/process-complex')
  .inputSchema(z.object({ name: z.string() }))
  .outputSchema(z.object({ processed: z.boolean() }))
  .run({ name: 'demo' });

console.log(definitions.length, siteTitle.title, processed.processed);
```

## Method reference

### Read helpers

- `getPosts`, `getAllPosts`, `getPostsPaginated`, `getPost`, `getPostBySlug`
- `getPages`, `getAllPages`, `getPagesPaginated`, `getPage`, `getPageBySlug`
- `getMedia`, `getAllMedia`, `getMediaPaginated`, `getMediaItem`, `getMediaBySlug`, `getImageUrl`
- `getCategories`, `getAllCategories`, `getCategoriesPaginated`, `getCategory`, `getCategoryBySlug`
- `getTags`, `getAllTags`, `getTagsPaginated`, `getTag`, `getTagBySlug`
- `getUsers`, `getAllUsers`, `getUsersPaginated`, `getUser`, `getCurrentUser`
- `getComments`, `getAllComments`, `getCommentsPaginated`, `getComment`
- `getSettings`

### Generic resource helpers

- Content collections: `getContentCollection`, `getAllContentCollection`, `getContentCollectionPaginated`, `getContent`, `getContentBySlug`
- Term collections: `getTermCollection`, `getAllTermCollection`, `getTermCollectionPaginated`, `getTerm`, `getTermBySlug`
- Builders: `content(resource, schema?)`, `terms(resource, schema?)`

### Mutation helpers

- Content: `createContent`, `updateContent`, `deleteContent`
- Terms: `createTerm`, `updateTerm`, `deleteTerm`
- Posts/pages: `createPost`, `updatePost`, `deletePost`, `createPage`, `updatePage`, `deletePage`
- Taxonomy built-ins: `createCategory`, `updateCategory`, `deleteCategory`, `createTag`, `updateTag`, `deleteTag`
- Users: `createUser`, `updateUser`, `deleteUser`
- Comments: `createComment`, `updateComment`, `deleteComment`
- Media: `createMedia`, `uploadMedia`, `updateMedia`, `deleteMedia`
- Settings: `updateSettings`

### Auth and ability helpers

- `loginWithJwt(credentials)`
- `validateJwtToken(token?)`
- `getAbilities()` / `getAbility(name)`
- `getAbilityCategories()` / `getAbilityCategory(slug)`
- `executeGetAbility(name, input?, responseSchema?)`
- `executeRunAbility(name, input?, responseSchema?)`
- `executeDeleteAbility(name, input?, responseSchema?)`
- `ability<TInput, TOutput>(name)`

### Relation helpers

- `post(idOrSlug).with(...relations).get()`
- `getPostWithRelations(idOrSlug, ...relations)`

Supported relation names:

- `author`
- `categories`
- `tags`
- `terms`
- `featuredMedia`

### Transport and request control

- `request(options)`
- `fetchAPI(endpoint, params?)`
- `fetchAPIPaginated(endpoint, params?)`
- `setHeaders(name, value)` / `setHeaders(headers)`
- `hasAuth()`

## CRUD walkthrough

### Posts

```ts
const createdPost = await wp.createPost({ title: 'Post title', status: 'draft' });

const updatedPost = await wp.updatePost(createdPost.id, {
  title: 'Post title updated',
  status: 'publish',
});

await wp.deletePost(createdPost.id, { force: true });
```

### Pages

```ts
const createdPage = await wp.createPage({ title: 'About us', status: 'draft' });

await wp.updatePage(createdPage.id, { status: 'publish' });
await wp.deletePage(createdPage.id, { force: true });
```

### Categories and tags

```ts
const category = await wp.createCategory({ name: 'News' });
const tag = await wp.createTag({ name: 'featured' });

await wp.updateCategory(category.id, { name: 'Company News' });
await wp.updateTag(tag.id, { name: 'featured-updated' });

await wp.deleteCategory(category.id, { force: true });
await wp.deleteTag(tag.id, { force: true });
```

### Comments

```ts
const post = await wp.getPostBySlug('hello-world');

if (!post) {
  throw new Error('Post not found.');
}

const comment = await wp.createComment({
  post: post.id,
  content: 'Nice post!',
  status: 'approve',
});

await wp.updateComment(comment.id, { content: 'Nice post, updated.' });
await wp.deleteComment(comment.id, { force: true });
```

### Media upload

```ts
const media = await wp.uploadMedia({
  file: imageBlob,
  filename: 'cover.jpg',
  mimeType: 'image/jpeg',
  title: 'Cover image',
  alt_text: 'Book cover image',
});

await wp.updateMedia(media.id, { caption: 'Updated caption' });
await wp.deleteMedia(media.id, { force: true });
```

### Generic CPT CRUD

```ts
const books = wp.content('books');

const createdBook = await books.create({ title: 'Book title', status: 'draft' });
await books.update(createdBook.id, { status: 'publish' });
await books.delete(createdBook.id, { force: true });
```

### Generic taxonomy CRUD

```ts
const genres = wp.terms('genre');

const createdGenre = await genres.create({ name: 'Sci-Fi' });
await genres.update(createdGenre.id, { name: 'Science Fiction' });
await genres.delete(createdGenre.id, { force: true });
```

### WPAPI-style CRUD chain

```ts
const created = await wp.posts().create({ title: 'Chain post', status: 'draft' });
const postId = (created as { id: number }).id;

await wp.posts().id(postId).update({ status: 'publish' });
await wp.posts().id(postId).delete({ force: true });
```

## Full WPAPI-compatible syntax

### Root chain starters

- `posts()`
- `pages()`
- `media()`
- `categories()`
- `tags()`
- `users()`
- `comments()`
- `settings()`
- `types()`
- `taxonomies()`
- `statuses()`
- `search()`
- `blocks()`

### Chain query methods

- `id(value)`
- `param(name, value)`
- `params(record)`
- `slug(value)`
- `page(value)`
- `perPage(value)`
- `offset(value)`
- `search(value)`
- `status(value)`
- `author(value)`
- `categories(value)`
- `tags(value)`
- `include(value)`
- `exclude(value)`
- `order('asc' | 'desc')`
- `orderby(value)`
- `context(value)`
- `password(value)`
- `embed()`
- `setHeaders(...)` / `headers(...)`
- `auth(value)`
- `authHeaders(value)`
- `cookies(value)`
- `credentials(value)`
- `toString()`
- `get()`
- `create(payload)`
- `update(payload)`
- `delete({ force? })`
- thenable support: `await wp.posts().slug('hello-world')`

### Namespace and route helpers

- `route(resource, namespace?)`
- `namespace('my-plugin/v1').route('sync')`
- `namespace('my-plugin/v1').resource('sync')`
- `registerRoute('my-plugin/v1', '/authors/(?P<id>)')`

## Standard Schema validation

Mutation helpers accept any Standard Schema-compatible validator.

```ts
import { z } from 'zod';

const minimalPostSchema = z.object({
  id: z.number(),
  slug: z.string(),
  status: z.string(),
});

const created = await wp.createPost(
  { title: 'Schema validated', status: 'draft' },
  minimalPostSchema,
);
```

## Pagination guidance

- WordPress caps `per_page` at `100`.
- Use `getAll*()` helpers for complete datasets.
- Use `get*Paginated()` helpers when you need totals and page metadata.

## Error handling guidance

- API errors throw `WordPressApiError`.
- Validation errors throw `WordPressSchemaValidationError`.
- Cross-origin absolute URLs are rejected before requests are sent.

## Next docs

- Custom endpoints: `docs/custom-endpoints.md`
- Abilities: `docs/abilities.md`
- node-wpapi migration: `docs/migration-from-node-wpapi.md`
