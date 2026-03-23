import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressContent,
  WordPressMedia,
  WordPressPost,
  WordPressTag,
} from '../schemas.js';
import type { WordPressRequestOptions, WordPressRequestResult } from '../client-types.js';
import type { QueryParams } from '../types/resources.js';

/**
 * Base interface for extracting embedded data from any WordPress response.
 * 
 * Plugins and custom implementations can provide their own extractors
 * for custom _embed paths like 'acf:post', 'my-plugin:item', etc.
 */
export interface EmbeddedDataExtractor<T> {
  /**
   * The key in _embedded to extract data from (e.g., 'wp:term', 'acf:post').
   */
  embeddedKey: string;
  
  /**
   * Extracts and transforms embedded data into the expected type.
   * @param embeddedData - The raw data from _embedded[embeddedKey]
   * @returns The extracted and typed data, or null/empty if not available
   */
  extract(embeddedData: unknown): T | null;
}

/**
 * Interface for resolving relations when embedded data is unavailable.
 * Falls back to making API calls using ID fields from the post.
 */
export interface RelationFallbackResolver<T> {
  /**
   * Resolves the relation by making API calls when embedded data is missing.
   * @param client - The WordPress client for making API requests
   * @param post - The post containing ID fields for the relation
   * @returns Promise resolving to the related data
   */
  resolve(
    client: PostRelationClient,
    post: WordPressContent,
  ): Promise<T>;
}

/**
 * Configuration for a custom relation type.
 * 
 * This is the main interface for extending the relation hydration system.
 * Plugins can define custom relations by implementing this interface.
 * 
 * @example
 * ```typescript
 * // Custom plugin relation
 * const customRelation: CustomRelationConfig<CustomItem[]> = {
 *   name: 'customItems',
 *   embeddedKey: 'my-plugin:items',
 *   extractEmbedded: (data) => {
 *     if (!Array.isArray(data)) return [];
 *     return data.map(item => transformItem(item));
 *   },
 *   fallbackResolver: async (client, post) => {
 *     const ids = post.meta?.custom_item_ids;
 *     if (!ids?.length) return [];
 *     return fetchCustomItems(ids);
 *   },
 * };
 * ```
 */
export interface CustomRelationConfig<T> {
  /**
   * Unique name for this relation (used in .with() calls).
   */
  name: string;
  
  /**
   * The _embed parameter value to request for this relation.
   * If not provided, uses the embeddedKey.
   */
  embedParam?: string;
  
  /**
   * The key in _embedded to extract data from.
   * @default The relation name
   */
  embeddedKey: string;
  
  /**
   * Extracts embedded data from the _embedded response.
   * @param embeddedData - Raw data from _embedded[embeddedKey]
   * @returns Extracted data or null if not available
   */
  extractEmbedded: (embeddedData: unknown) => T | null;
  
  /**
   * Optional fallback resolver when embedded data is unavailable.
   * If not provided, the relation will be null/empty when embedded data is missing.
   */
  fallbackResolver?: RelationFallbackResolver<T>;
  
  /**
   * Fields that must be preserved in the response for this relation to work.
   * These fields are automatically added to _fields when using this relation.
   */
  requiredFields?: string[];
}

/**
 * Options for collection relations backed by numeric reference IDs.
 */
export interface IdCollectionRelationOptions<T> {
  /**
   * Public relation name used in `.with(...)`.
   */
  name: string;

  /**
   * Key inside `_embedded` that exposes the hydrated records.
   */
  embeddedKey: string;

  /**
   * Extracts one embedded item into the consumer-facing DTO.
   */
  extractEmbeddedItem: (item: unknown) => T | null;

  /**
   * Reads the raw ID list from the parent post when `_embedded` is unavailable.
   */
  getIds: (post: WordPressContent) => unknown;

  /**
   * Resolves the referenced items from their IDs.
   */
  resolveMany: (client: PostRelationClient, ids: number[]) => Promise<T[]>;

  /**
   * Fields required for fallback hydration.
   */
  requiredFields?: string[];
}

/**
 * Options for single-item relations backed by one numeric reference ID.
 */
export interface IdSingleRelationOptions<T> {
  /**
   * Public relation name used in `.with(...)`.
   */
  name: string;

  /**
   * Key inside `_embedded` that exposes the hydrated record.
   */
  embeddedKey: string;

  /**
   * Extracts one embedded item into the consumer-facing DTO.
   */
  extractEmbeddedItem: (item: unknown) => T | null;

  /**
   * Reads the raw ID value from the parent post when `_embedded` is unavailable.
   */
  getId: (post: WordPressContent) => unknown;

  /**
   * Resolves the referenced item from its ID.
   */
  resolveOne: (client: PostRelationClient, id: number) => Promise<T | null>;

  /**
   * Fields required for fallback hydration.
   */
  requiredFields?: string[];
}

/**
 * Shared options for relations that resolve through `_links` and `_embedded`.
 */
export interface LinkedEmbeddedRelationOptionsBase<T extends { id: number }> {
  /**
   * Public relation name used in `.with(...)`.
   */
  name: string;

  /**
   * Key inside `_embedded` that exposes the related records.
   */
  embeddedKey: string;

  /**
   * Optional key inside `_links`.
   * Defaults to the `embeddedKey` when omitted.
   */
  linksKey?: string;

  /**
   * Normalizes embedded or linked API responses to the relation DTO.
   */
  extractItem: (item: unknown) => T | null;

  /**
   * Optional parser for relation field values.
   * Defaults to positive integer numbers and numeric strings.
   */
  parseReferenceId?: (value: unknown) => number | null;

  /**
   * Optional parser for `_links` items.
   * Defaults to numeric IDs in the final URL segment or common query params.
   */
  parseLinkId?: (link: Record<string, unknown>) => number | null;

  /**
   * Fields required for relation hydration.
   */
  requiredFields?: string[];
}

/**
 * Options for collection relations that share one link/embed bucket.
 */
export interface LinkedEmbeddedCollectionRelationOptions<T extends { id: number }>
  extends LinkedEmbeddedRelationOptionsBase<T> {
  /**
   * Reads raw relation IDs from the parent record.
   */
  getIds: (post: WordPressContent) => unknown;

  /**
   * Optional last-resort resolver for IDs that cannot be found in links/embeds.
   */
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
}

/**
 * Options for single relations that share one link/embed bucket.
 */
export interface LinkedEmbeddedSingleRelationOptions<T extends { id: number }>
  extends LinkedEmbeddedRelationOptionsBase<T> {
  /**
   * Reads one raw relation ID from the parent record.
   */
  getId: (post: WordPressContent) => unknown;

  /**
   * Optional last-resort resolver for the missing related record.
   */
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
}

/**
 * Registry for custom relation configurations.
 * Allows runtime registration of new relation types.
 */
export class CustomRelationRegistry {
  private relations = new Map<string, CustomRelationConfig<unknown>>();
  
  /**
   * Registers a custom relation configuration.
   * @param config - The relation configuration to register
   */
  register<T>(config: CustomRelationConfig<T>): void {
    this.relations.set(config.name, config as CustomRelationConfig<unknown>);
  }
  
  /**
   * Gets a registered relation configuration by name.
   * @param name - The relation name
   * @returns The configuration or undefined if not found
   */
  get(name: string): CustomRelationConfig<unknown> | undefined {
    return this.relations.get(name);
  }
  
  /**
   * Checks if a relation is registered.
   * @param name - The relation name
   */
  has(name: string): boolean {
    return this.relations.has(name);
  }
  
  /**
   * Gets all registered relation names.
   */
  getAllNames(): string[] {
    return Array.from(this.relations.keys());
  }
  
  /**
   * Unregisters a relation.
   * @param name - The relation name to remove
   */
  unregister(name: string): boolean {
    return this.relations.delete(name);
  }
  
  /**
   * Clears all registered custom relations.
   */
  clear(): void {
    this.relations.clear();
  }
}

/**
 * Global registry instance for custom relations.
 * 
 * Use this to register plugin-specific relations globally:
 * ```typescript
 * import { customRelationRegistry } from 'fluent-wp-client';
 * 
 * customRelationRegistry.register({
 *   name: 'myPluginItems',
 *   embeddedKey: 'my-plugin:items',
 *   extractEmbedded: (data) => Array.isArray(data) ? data : null,
 * });
 * ```
 */
export const customRelationRegistry = new CustomRelationRegistry();

/**
 * Client surface required by the post relation hydrator.
 */
export interface PostRelationClient {
  getPost: (id: number) => PromiseLike<WordPressPost>;
  getPostBySlug: (slug: string) => PromiseLike<WordPressPost | undefined>;
  getContent?: <TContent = WordPressContent>(resource: string, id: number) => Promise<TContent>;
  getContentBySlug?: <TContent = WordPressContent>(resource: string, slug: string) => Promise<TContent | undefined>;
  request?: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  getUser: (id: number) => Promise<WordPressAuthor>;
  getUsers?: (filter?: { include?: number[]; perPage?: number }) => Promise<WordPressAuthor[]>;
  getCategories: (filter?: { include?: number[] }) => Promise<WordPressCategory[]>;
  getTags: (filter?: { include?: number[] }) => Promise<WordPressTag[]>;
  getMediaItem: (id: number) => Promise<WordPressMedia>;
  getTermCollection?: <TTerm = WordPressCategory>(
    resource: string,
    filter?: QueryParams,
  ) => Promise<TTerm[]>;
  getTerm?: <TTerm = WordPressCategory>(resource: string, id: number) => Promise<TTerm>;
}

/**
 * Lightweight DTO used for post-reference relations.
 */
export interface RelatedPostReference {
  id: number;
  title?: { rendered?: string } | string;
  slug?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Lightweight DTO used for generic content-reference relations.
 */
export interface RelatedContentReference extends RelatedPostReference {}

/**
 * Lightweight DTO used for term-reference relations.
 */
export interface RelatedTermReference {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
  [key: string]: unknown;
}

/**
 * Helper to extract embedded data from a post by key.
 */
export function extractEmbeddedData<T>(
  post: WordPressContent,
  key: string,
): T | undefined {
  const embedded = (post as { _embedded?: Record<string, unknown> })._embedded;
  return embedded?.[key] as T | undefined;
}

/**
 * Creates an embedded extractor that expects an array and returns typed items.
 */
export function createArrayExtractor<T>(
  transform: (item: unknown) => T | null,
): (data: unknown) => T[] | null {
  return (data: unknown): T[] | null => {
    if (!Array.isArray(data)) {
      return null;
    }
    
    const results: T[] = [];
    for (const item of data) {
      const transformed = transform(item);
      if (transformed !== null) {
        results.push(transformed);
      }
    }
    
    return results.length > 0 ? results : null;
  };
}

/**
 * Creates an embedded extractor for single-item relations.
 */
export function createSingleExtractor<T>(
  transform: (item: unknown) => T | null,
): (data: unknown) => T | null {
  return (data: unknown): T | null => {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    return transform(data[0]);
  };
}

/**
 * Default parser for numeric relation field values.
 */
export function defaultParseReferenceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Default parser for numeric relation IDs exposed in `_links` href values.
 */
export function defaultParseLinkId(link: Record<string, unknown>): number | null {
  const href = typeof link.href === 'string' ? link.href : undefined;

  if (!href) {
    return null;
  }

  try {
    const url = new URL(href);
    const lastSegment = url.pathname.split('/').filter(Boolean).pop();
    const pathId = lastSegment ? Number(lastSegment) : NaN;

    if (Number.isInteger(pathId) && pathId > 0) {
      return pathId;
    }

    for (const key of ['id', 'post', 'parent']) {
      const param = url.searchParams.get(key);
      const queryId = param ? Number(param) : NaN;

      if (Number.isInteger(queryId) && queryId > 0) {
        return queryId;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Normalizes one raw relation field value to ordered numeric IDs.
 */
function normalizeReferenceIds(
  value: unknown,
  parseReferenceId: (value: unknown) => number | null,
): number[] {
  if (Array.isArray(value)) {
    return value
      .map(parseReferenceId)
      .filter((id): id is number => id !== null);
  }

  const id = parseReferenceId(value);
  return id === null ? [] : [id];
}

/**
 * Reads embedded relation items for one shared bucket.
 */
export function getEmbeddedRelationItems<T extends { id: number }>(
  content: WordPressContent,
  embeddedKey: string,
  extractItem: (item: unknown) => T | null,
): T[] {
  const embedded = (content as { _embedded?: Record<string, unknown> })._embedded?.[embeddedKey];

  if (!Array.isArray(embedded)) {
    return [];
  }

  const items: T[] = [];
  const seenIds = new Set<number>();

  for (const item of embedded) {
    const transformed = extractItem(item);

    if (!transformed || seenIds.has(transformed.id)) {
      continue;
    }

    seenIds.add(transformed.id);
    items.push(transformed);
  }

  return items;
}

/**
 * Reads linked relation IDs for one shared bucket.
 */
export function getLinkedRelationIds(
  content: WordPressContent,
  linksKey: string,
  parseLinkId: (link: Record<string, unknown>) => number | null = defaultParseLinkId,
): number[] {
  const links = (content as { _links?: Record<string, unknown> })._links?.[linksKey];

  if (!Array.isArray(links)) {
    return [];
  }

  const ids: number[] = [];
  const seenIds = new Set<number>();

  for (const item of links as Array<Record<string, unknown>>) {
    const id = parseLinkId(item);

    if (id === null || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    ids.push(id);
  }

  return ids;
}

/**
 * Builds one embedded-item lookup for one shared bucket.
 */
function getEmbeddedRelationLookup<T extends { id: number }>(
  content: WordPressContent,
  embeddedKey: string,
  extractItem: (item: unknown) => T | null,
): Map<number, T> {
  const lookup = new Map<number, T>();

  for (const item of getEmbeddedRelationItems(content, embeddedKey, extractItem)) {
    lookup.set(item.id, item);
  }

  return lookup;
}

/**
 * Builds one linked-item href lookup for one shared bucket.
 */
function getLinkedRelationLookup(
  content: WordPressContent,
  linksKey: string,
  parseLinkId: (link: Record<string, unknown>) => number | null,
): Map<number, string> {
  const links = (content as { _links?: Record<string, unknown> })._links?.[linksKey];

  if (!Array.isArray(links)) {
    return new Map<number, string>();
  }

  const lookup = new Map<number, string>();

  for (const item of links as Array<Record<string, unknown>>) {
    const href = typeof item.href === 'string' ? item.href : undefined;
    const id = parseLinkId(item);

    if (!href || id === null) {
      continue;
    }

    lookup.set(id, href);
  }

  return lookup;
}

/**
 * Fetches one linked resource through the low-level client request API.
 */
async function fetchLinkedRelationItem<T extends { id: number }>(
  client: PostRelationClient,
  href: string,
  extractItem: (item: unknown) => T | null,
): Promise<T | null> {
  if (!client.request) {
    return null;
  }

  try {
    const { data, response } = await client.request<unknown>({
      endpoint: href,
      method: 'GET',
    });

    if (!response.ok) {
      return null;
    }

    return extractItem(data);
  } catch {
    return null;
  }
}

/**
 * Resolves a shared-bucket collection relation using field IDs, `_embedded`, `_links`, and optional fallback requests.
 */
async function resolveLinkedEmbeddedCollection<T extends { id: number }>(
  client: PostRelationClient,
  content: WordPressContent,
  ids: number[],
  options: {
    embeddedKey: string;
    linksKey: string;
    extractItem: (item: unknown) => T | null;
    parseLinkId: (link: Record<string, unknown>) => number | null;
    resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
  },
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }

  const requestedIds = Array.from(new Set(ids));
  const resolved = new Map<number, T>();
  const embeddedLookup = getEmbeddedRelationLookup(content, options.embeddedKey, options.extractItem);

  for (const id of requestedIds) {
    const embedded = embeddedLookup.get(id);

    if (embedded) {
      resolved.set(id, embedded);
    }
  }

  const linkLookup = getLinkedRelationLookup(content, options.linksKey, options.parseLinkId);

  for (const id of requestedIds) {
    if (resolved.has(id)) {
      continue;
    }

    const href = linkLookup.get(id);

    if (!href) {
      continue;
    }

    const linkedItem = await fetchLinkedRelationItem(client, href, options.extractItem);

    if (linkedItem) {
      resolved.set(id, linkedItem);
    }
  }

  const missingIds = requestedIds.filter((id) => !resolved.has(id));

  if (missingIds.length > 0 && options.resolveMany) {
    for (const item of await options.resolveMany(client, missingIds)) {
      resolved.set(item.id, item);
    }
  }

  return ids
    .map((id) => resolved.get(id))
    .filter((item): item is T => item !== undefined);
}

/**
 * Resolves a shared-bucket single relation using field IDs, `_embedded`, `_links`, and optional fallback requests.
 */
async function resolveLinkedEmbeddedSingle<T extends { id: number }>(
  client: PostRelationClient,
  content: WordPressContent,
  id: number | null,
  options: {
    embeddedKey: string;
    linksKey: string;
    extractItem: (item: unknown) => T | null;
    parseLinkId: (link: Record<string, unknown>) => number | null;
    resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
  },
): Promise<T | null> {
  if (id === null) {
    return null;
  }

  const [resolved] = await resolveLinkedEmbeddedCollection(client, content, [id], {
    embeddedKey: options.embeddedKey,
    linksKey: options.linksKey,
    extractItem: options.extractItem,
    parseLinkId: options.parseLinkId,
    resolveMany: options.resolveOne
      ? async (relationClient, ids) => {
        const item = await options.resolveOne?.(relationClient, ids[0] ?? 0);
        return item ? [item] : [];
      }
      : undefined,
  });

  return resolved ?? null;
}

/**
 * Normalizes one post response to a lightweight related-post DTO.
 */
export function toRelatedPostReference(post: WordPressPost): RelatedPostReference {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    type: post.type,
  };
}

/**
 * Normalizes one content response to a lightweight related-content DTO.
 */
export function toRelatedContentReference(content: WordPressContent): RelatedContentReference {
  return {
    id: content.id,
    title: content.title,
    slug: content.slug,
    type: content.type,
  };
}

/**
 * Resolves many content references from numeric IDs for any content resource.
 */
export async function resolveContentReferences(
  client: PostRelationClient,
  resource: string,
  ids: number[],
): Promise<RelatedContentReference[]> {
  if (ids.length === 0) {
    return [];
  }

  if (resource === 'posts') {
    return resolvePostReferences(client, ids);
  }

  if (!client.getContent) {
    return [];
  }

  const items: RelatedContentReference[] = [];

  for (const id of ids) {
    try {
      const content = await client.getContent<WordPressContent>(resource, id);
      items.push(toRelatedContentReference(content));
    } catch {
      continue;
    }
  }

  return items;
}

/**
 * Resolves one content reference from a numeric ID for any content resource.
 */
export async function resolveContentReference(
  client: PostRelationClient,
  resource: string,
  id: number,
): Promise<RelatedContentReference | null> {
  if (id <= 0) {
    return null;
  }

  if (resource === 'posts') {
    return resolvePostReference(client, id);
  }

  if (!client.getContent) {
    return null;
  }

  try {
    const content = await client.getContent<WordPressContent>(resource, id);
    return toRelatedContentReference(content);
  } catch {
    return null;
  }
}

/**
 * Resolves many post references from numeric IDs.
 */
export async function resolvePostReferences(
  client: PostRelationClient,
  ids: number[],
): Promise<RelatedPostReference[]> {
  const posts: RelatedPostReference[] = [];

  for (const id of ids) {
    try {
      const post = await client.getPost(id);
      posts.push(toRelatedPostReference(post));
    } catch {
      continue;
    }
  }

  return posts;
}

/**
 * Resolves one post reference from a numeric ID.
 */
export async function resolvePostReference(
  client: PostRelationClient,
  id: number,
): Promise<RelatedPostReference | null> {
  if (id <= 0) {
    return null;
  }

  try {
    const post = await client.getPost(id);
    return toRelatedPostReference(post);
  } catch {
    return null;
  }
}

/**
 * Normalizes one term response to a lightweight related-term DTO.
 */
export function toRelatedTermReference(term: WordPressCategory): RelatedTermReference {
  return {
    id: term.id,
    name: term.name,
    slug: term.slug,
    taxonomy: term.taxonomy,
  };
}

/**
 * Resolves many term references from numeric IDs for any taxonomy resource.
 */
export async function resolveTermReferences(
  client: PostRelationClient,
  resource: string,
  ids: number[],
): Promise<RelatedTermReference[]> {
  if (ids.length === 0) {
    return [];
  }

  if (client.getTermCollection) {
    try {
      // Omit perPage so filterToParams applies the default per_page=100 cap.
      // Requesting perPage: ids.length would exceed WordPress's hard limit of 100
      // and silently truncate results when more than 100 IDs are provided.
      const terms = await client.getTermCollection<WordPressCategory>(resource, {
        include: ids,
      });
      return terms.map(toRelatedTermReference);
    } catch {
      return [];
    }
  }

  if (!client.getTerm) {
    return [];
  }

  const terms: RelatedTermReference[] = [];

  for (const id of ids) {
    try {
      const term = await client.getTerm<WordPressCategory>(resource, id);
      terms.push(toRelatedTermReference(term));
    } catch {
      continue;
    }
  }

  return terms;
}

/**
 * Resolves one term reference from a numeric ID for any taxonomy resource.
 */
export async function resolveTermReference(
  client: PostRelationClient,
  resource: string,
  id: number,
): Promise<RelatedTermReference | null> {
  if (id <= 0) {
    return null;
  }

  if (client.getTerm) {
    try {
      const term = await client.getTerm<WordPressCategory>(resource, id);
      return toRelatedTermReference(term);
    } catch {
      return null;
    }
  }

  const terms = await resolveTermReferences(client, resource, [id]);
  return terms[0] ?? null;
}

/**
 * Creates a collection relation for APIs that expose one shared `_links` / `_embedded` bucket.
 *
 * This is useful when multiple logical fields share the same relation key and
 * must be filtered by the field's stored IDs before using embedded data.
 */
export function createLinkedEmbeddedCollectionRelation<T extends { id: number }>(
  options: LinkedEmbeddedCollectionRelationOptions<T>,
): CustomRelationConfig<T[]> {
  const linksKey = options.linksKey ?? options.embeddedKey;
  const parseReferenceId = options.parseReferenceId ?? defaultParseReferenceId;
  const parseLinkId = options.parseLinkId ?? defaultParseLinkId;

  return {
    name: options.name,
    embeddedKey: options.embeddedKey,
    extractEmbedded: () => null,
    requiredFields: options.requiredFields,
    fallbackResolver: {
      resolve: async (client: PostRelationClient, post: WordPressContent) => resolveLinkedEmbeddedCollection(
        client,
        post,
        normalizeReferenceIds(options.getIds(post), parseReferenceId),
        {
          embeddedKey: options.embeddedKey,
          linksKey,
          extractItem: options.extractItem,
          parseLinkId,
          resolveMany: options.resolveMany,
        },
      ),
    },
  };
}

/**
 * Creates a single relation for APIs that expose one shared `_links` / `_embedded` bucket.
 *
 * This is useful when multiple logical fields share the same relation key and
 * must be filtered by the field's stored ID before using embedded data.
 */
export function createLinkedEmbeddedSingleRelation<T extends { id: number }>(
  options: LinkedEmbeddedSingleRelationOptions<T>,
): CustomRelationConfig<T | null> {
  const linksKey = options.linksKey ?? options.embeddedKey;
  const parseReferenceId = options.parseReferenceId ?? defaultParseReferenceId;
  const parseLinkId = options.parseLinkId ?? defaultParseLinkId;

  return {
    name: options.name,
    embeddedKey: options.embeddedKey,
    extractEmbedded: () => null,
    requiredFields: options.requiredFields,
    fallbackResolver: {
      resolve: async (client: PostRelationClient, post: WordPressContent) => {
        const id = normalizeReferenceIds(options.getId(post), parseReferenceId)[0] ?? null;

        return resolveLinkedEmbeddedSingle(client, post, id, {
          embeddedKey: options.embeddedKey,
          linksKey,
          extractItem: options.extractItem,
          parseLinkId,
          resolveOne: options.resolveOne,
        });
      },
    },
  };
}

/**
 * Creates a collection relation that falls back to numeric reference IDs.
 */
export function createIdCollectionRelation<T>(
  options: IdCollectionRelationOptions<T>,
): CustomRelationConfig<T[]> {
  return {
    name: options.name,
    embeddedKey: options.embeddedKey,
    extractEmbedded: createArrayExtractor(options.extractEmbeddedItem),
    requiredFields: options.requiredFields,
    fallbackResolver: {
      resolve: async (client: PostRelationClient, post: WordPressContent) => {
        const ids = options.getIds(post);

        if (!Array.isArray(ids) || ids.length === 0) {
          return [];
        }

        const validIds = ids.filter((id): id is number => typeof id === 'number' && id > 0);

        if (validIds.length === 0) {
          return [];
        }

        return options.resolveMany(client, validIds);
      },
    },
  };
}

/**
 * Creates a single-item relation that falls back to one numeric reference ID.
 */
export function createIdSingleRelation<T>(
  options: IdSingleRelationOptions<T>,
): CustomRelationConfig<T | null> {
  return {
    name: options.name,
    embeddedKey: options.embeddedKey,
    extractEmbedded: createSingleExtractor(options.extractEmbeddedItem),
    requiredFields: options.requiredFields,
    fallbackResolver: {
      resolve: async (client: PostRelationClient, post: WordPressContent) => {
        const id = options.getId(post);

        if (typeof id !== 'number') {
          return null;
        }

        return options.resolveOne(client, id);
      },
    },
  };
}
