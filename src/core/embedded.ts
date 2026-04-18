import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressComment,
  WordPressMedia,
  WordPressPostLike,
  WordPressTag,
} from "../schemas.js";

/**
 * Shape of a resource that may carry WordPress `_embedded` data.
 */
interface EmbeddedSource {
  _embedded?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Reads one `_embedded` key and returns its raw value.
 */
export function getEmbeddedData(
  source: unknown,
  key: string,
): unknown | undefined {
  const embedded = (source as EmbeddedSource)?._embedded;

  if (!embedded || typeof embedded !== "object") {
    return undefined;
  }

  return embedded[key];
}

/**
 * Returns the first element of an embedded array, or `null` when absent.
 */
function firstEmbeddedItem<T>(source: unknown, key: string): T | null {
  const data = getEmbeddedData(source, key);

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const item = data[0];
  return item && typeof item === "object" && "id" in item ? (item as T) : null;
}

// ---------------------------------------------------------------------------
// Built-in relation extractors
// ---------------------------------------------------------------------------

/**
 * Extracts the embedded author from `_embedded.author`.
 */
export function getEmbeddedAuthor(source: unknown): WordPressAuthor | null {
  return firstEmbeddedItem<WordPressAuthor>(source, "author");
}

/**
 * Extracts the embedded featured media from `_embedded['wp:featuredmedia']`.
 */
export function getEmbeddedFeaturedMedia(
  source: unknown,
): WordPressMedia | null {
  return firstEmbeddedItem<WordPressMedia>(source, "wp:featuredmedia");
}

/**
 * Extracts the embedded parent resource from `_embedded.up`.
 */
export function getEmbeddedParent<
  T extends WordPressPostLike = WordPressPostLike,
>(source: unknown): T | null {
  return firstEmbeddedItem<T>(source, "up");
}

/**
 * Extracts embedded terms from `_embedded['wp:term']`, optionally filtered by taxonomy.
 *
 * WordPress groups embedded terms as an array of arrays — one inner array
 * per taxonomy. This helper flattens and optionally filters that structure.
 *
 * @param source  A resource with `_embedded` data.
 * @param taxonomy  When provided, only terms matching this taxonomy are returned.
 */
export function getEmbeddedTerms<
  T extends { taxonomy?: string } = WordPressCategory | WordPressTag,
>(source: unknown, taxonomy?: string): T[] {
  const data = getEmbeddedData(source, "wp:term");

  if (!Array.isArray(data)) {
    return [];
  }

  const flat: T[] = [];

  for (const group of data) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const term of group) {
      if (!term || typeof term !== "object" || !("id" in term)) {
        continue;
      }

      if (taxonomy && (term as { taxonomy?: string }).taxonomy !== taxonomy) {
        continue;
      }

      flat.push(term as T);
    }
  }

  return flat;
}

/**
 * Extracts embedded replies (comments) from `_embedded.replies`.
 */
export function getEmbeddedReplies(source: unknown): WordPressComment[] {
  const data = getEmbeddedData(source, "replies");

  if (!Array.isArray(data)) {
    return [];
  }

  // WordPress wraps replies in a nested array.
  const group = Array.isArray(data[0]) ? data[0] : data;
  return group.filter(
    (item: unknown): item is WordPressComment =>
      !!item && typeof item === "object" && "id" in item,
  );
}

// ---------------------------------------------------------------------------
// ACF embedded data extractors
// ---------------------------------------------------------------------------

/**
 * Default `_embedded` key used by ACF for post-type link relations.
 */
export const ACF_POSTS_EMBED_KEY = "acf:post";

/**
 * Default `_embedded` key used by ACF for taxonomy link relations.
 */
export const ACF_TERMS_EMBED_KEY = "acf:term";

/**
 * Extracts all ACF-embedded posts from `_embedded['acf:post']`.
 *
 * The returned items are the raw objects WordPress inlined; callers can
 * correlate them with a specific ACF field value to pick only the relevant
 * entries (see `getAcfFieldPosts` for a field-scoped variant).
 *
 * Pass a CLI-generated type to narrow the result:
 * ```ts
 * const books = getAcfEmbeddedPosts<WPBook>(post, 'acf:post');
 * ```
 */
export function getAcfEmbeddedPosts<
  T extends { id: number } = WordPressPostLike,
>(source: unknown, key = ACF_POSTS_EMBED_KEY): T[] {
  const data = getEmbeddedData(source, key);

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (item: unknown): item is T =>
      !!item && typeof item === "object" && "id" in item,
  );
}

/**
 * Extracts all ACF-embedded terms from `_embedded['acf:term']`.
 */
export function getAcfEmbeddedTerms<
  T extends { id: number } = WordPressCategory,
>(source: unknown, key = ACF_TERMS_EMBED_KEY): T[] {
  const data = getEmbeddedData(source, key);

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (item: unknown): item is T =>
      !!item && typeof item === "object" && "id" in item,
  );
}

/**
 * Returns the embedded posts that match a specific ACF field's stored IDs.
 *
 * Reads `source.acf[fieldName]` to get the ID list, then correlates with
 * the `_embedded['acf:post']` bucket. Order follows the field value.
 *
 * Pass a CLI-generated type to narrow the result:
 * ```ts
 * const related = getAcfFieldPosts<WPBook>(post, 'acf_related_books');
 * ```
 */
export function getAcfFieldPosts<T extends { id: number } = WordPressPostLike>(
  source: unknown,
  fieldName: string,
  embedKey = ACF_POSTS_EMBED_KEY,
): T[] {
  const ids = getAcfFieldIds(source, fieldName);

  if (ids.length === 0) {
    return [];
  }

  const pool = getAcfEmbeddedPosts<T>(source, embedKey);
  const lookup = new Map(pool.map((p) => [p.id, p]));
  const result: T[] = [];

  for (const id of ids) {
    const match = lookup.get(id);

    if (match) {
      result.push(match);
    }
  }

  return result;
}

/**
 * Returns the single embedded post that matches an ACF post_object field.
 *
 * Pass a CLI-generated type to narrow the result:
 * ```ts
 * const featured = getAcfFieldPost<WPBook>(post, 'acf_featured_book');
 * ```
 */
export function getAcfFieldPost<T extends { id: number } = WordPressPostLike>(
  source: unknown,
  fieldName: string,
  embedKey = ACF_POSTS_EMBED_KEY,
): T | null {
  const id = getAcfFieldId(source, fieldName);

  if (id === null) {
    return null;
  }

  const pool = getAcfEmbeddedPosts<T>(source, embedKey);
  return pool.find((p) => p.id === id) ?? null;
}

/**
 * Returns the embedded terms that match a specific ACF taxonomy field's stored IDs.
 */
export function getAcfFieldTerms<T extends { id: number } = WordPressCategory>(
  source: unknown,
  fieldName: string,
  embedKey = ACF_TERMS_EMBED_KEY,
): T[] {
  const ids = getAcfFieldIds(source, fieldName);

  if (ids.length === 0) {
    return [];
  }

  const pool = getAcfEmbeddedTerms<T>(source, embedKey);
  const lookup = new Map(pool.map((t) => [t.id, t]));
  const result: T[] = [];

  for (const id of ids) {
    const match = lookup.get(id);

    if (match) {
      result.push(match);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// ACF field value helpers
// ---------------------------------------------------------------------------

/**
 * Reads numeric IDs from an ACF field value (handles single ID and arrays).
 */
export function getAcfFieldIds(source: unknown, fieldName: string): number[] {
  const acf = (source as { acf?: Record<string, unknown> })?.acf;

  if (!acf || typeof acf !== "object") {
    return [];
  }

  const raw = acf[fieldName];

  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((v) => Number.isFinite(v) && v > 0);
  }

  if (typeof raw === "number" && raw > 0) {
    return [raw];
  }

  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? [parsed] : [];
  }

  return [];
}

/**
 * Reads a single numeric ID from an ACF field value.
 */
export function getAcfFieldId(
  source: unknown,
  fieldName: string,
): number | null {
  const ids = getAcfFieldIds(source, fieldName);
  return ids.length > 0 ? ids[0] : null;
}

// ---------------------------------------------------------------------------
// _links helpers
// ---------------------------------------------------------------------------

/**
 * Shape of one WordPress `_links` entry.
 */
export interface WordPressLinkEntry {
  embeddable?: boolean;
  href: string;
  taxonomy?: string;
  [key: string]: unknown;
}

/**
 * Returns all `_links` entries for a given link relation key.
 */
export function getLinkEntries(
  source: unknown,
  key: string,
): WordPressLinkEntry[] {
  const links = (source as { _links?: Record<string, unknown> })?._links;

  if (!links || typeof links !== "object") {
    return [];
  }

  const entries = links[key];
  return Array.isArray(entries) ? (entries as WordPressLinkEntry[]) : [];
}

/**
 * Returns all embeddable link relation keys from a resource's `_links`.
 *
 * Useful for discovering which relations are available for selective `_embed`:
 *
 * ```ts
 * const post = await wp.content('posts').item(1, { fields: ['id', '_links'] });
 * const embeddable = getEmbeddableLinkKeys(post);
 * // ['author', 'wp:term', 'wp:featuredmedia', 'wp:attachment', ...]
 * ```
 */
export function getEmbeddableLinkKeys(source: unknown): string[] {
  const links = (source as { _links?: Record<string, unknown> })?._links;

  if (!links || typeof links !== "object") {
    return [];
  }

  const keys: string[] = [];

  for (const [key, entries] of Object.entries(links)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    const hasEmbeddable = entries.some(
      (entry: unknown) =>
        !!entry &&
        typeof entry === "object" &&
        (entry as { embeddable?: boolean }).embeddable === true,
    );

    if (hasEmbeddable) {
      keys.push(key);
    }
  }

  return keys;
}
