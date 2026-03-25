import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressContent,
  WordPressMedia,
  WordPressPost,
  WordPressPostLike,
} from '../schemas.js';
import type { WordPressRequestOptions, WordPressRequestResult } from '../types/client.js';
import type { QueryParams, WordPressRequestOverrides } from '../types/resources.js';

/**
 * Base interface for extracting embedded data from any WordPress response.
 */
export interface EmbeddedDataExtractor<T> {
  embeddedKey: string;
  extract(embeddedData: unknown): T | null;
}

/**
 * Interface for resolving relations when embedded data is unavailable.
 */
export interface RelationFallbackResolver<T> {
  resolve(
    client: PostRelationClient,
    post: WordPressPostLike,
  ): Promise<T>;
}

/**
 * Configuration for a custom relation type.
 */
export interface CustomRelationConfig<T> {
  name: string;
  embedParam?: string;
  embeddedKey: string;
  extractEmbedded: (embeddedData: unknown) => T | null;
  fallbackResolver?: RelationFallbackResolver<T>;
  requiredFields?: string[];
}

/**
 * Options for collection relations backed by numeric reference IDs.
 */
export interface IdCollectionRelationOptions<T> {
  name: string;
  embeddedKey: string;
  extractEmbeddedItem: (item: unknown) => T | null;
  getIds: (post: WordPressContent) => unknown;
  resolveMany: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
  requiredFields?: string[];
}

/**
 * Options for single-item relations backed by one numeric reference ID.
 */
export interface IdSingleRelationOptions<T> {
  name: string;
  embeddedKey: string;
  extractEmbeddedItem: (item: unknown) => T | null;
  getId: (post: WordPressContent) => unknown;
  resolveOne: (client: PostRelationClient, id: number) => Promise<T | null>;
  requiredFields?: string[];
}

/**
 * Shared options for relations that resolve through `_links` and `_embedded`.
 */
export interface LinkedEmbeddedRelationOptionsBase<T extends { id: number }> {
  name: string;
  embeddedKey: string;
  linksKey?: string;
  extractItem: (item: unknown) => T | null;
  parseReferenceId?: (value: unknown) => number | null;
  parseLinkId?: (link: Record<string, unknown>) => number | null;
  requiredFields?: string[];
}

/**
 * Options for collection relations that share one link/embed bucket.
 */
export interface LinkedEmbeddedCollectionRelationOptions<T extends { id: number }>
  extends LinkedEmbeddedRelationOptionsBase<T> {
  getIds: (post: WordPressContent) => unknown;
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
}

/**
 * Options for single relations that share one link/embed bucket.
 */
export interface LinkedEmbeddedSingleRelationOptions<T extends { id: number }>
  extends LinkedEmbeddedRelationOptionsBase<T> {
  getId: (post: WordPressContent) => unknown;
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
}

/**
 * Registry for custom relation configurations.
 */
export class CustomRelationRegistry {
  private readonly relations = new Map<string, CustomRelationConfig<unknown>>();

  register<T>(config: CustomRelationConfig<T>): void {
    this.relations.set(config.name, config as CustomRelationConfig<unknown>);
  }

  get(name: string): CustomRelationConfig<unknown> | undefined {
    return this.relations.get(name);
  }

  has(name: string): boolean {
    return this.relations.has(name);
  }

  getAllNames(): string[] {
    return Array.from(this.relations.keys());
  }

  unregister(name: string): boolean {
    return this.relations.delete(name);
  }

  clear(): void {
    this.relations.clear();
  }
}

/**
 * Global registry instance for custom relations.
 */
export const customRelationRegistry = new CustomRelationRegistry();

/**
 * Client surface required by the post relation hydrator.
 */
export interface PostRelationClient {
  content: <TContent extends WordPressPostLike = WordPressContent>(resource: string) => {
    item: (idOrSlug: number | string, options?: WordPressRequestOverrides) => PromiseLike<TContent | undefined>;
  };
  request?: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  users: () => {
    get: (id: number) => Promise<WordPressAuthor>;
    list: (filter?: { include?: number[]; perPage?: number }) => Promise<WordPressAuthor[]>;
  };
  media: () => {
    get: (id: number) => Promise<WordPressMedia>;
  };
  terms: <TTerm = WordPressCategory>(resource: string) => {
    list: (filter?: QueryParams, options?: WordPressRequestOverrides) => Promise<TTerm[]>;
    item: (idOrSlug: number | string, options?: WordPressRequestOverrides) => Promise<TTerm | undefined>;
  };
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
  post: WordPressPostLike,
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
    const pathId = lastSegment ? Number(lastSegment) : Number.NaN;

    if (Number.isInteger(pathId) && pathId > 0) {
      return pathId;
    }

    for (const key of ['id', 'post', 'parent']) {
      const param = url.searchParams.get(key);
      const queryId = param ? Number(param) : Number.NaN;

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
 * Normalizes one post response to a lightweight related-post DTO.
 */
export function toRelatedPostReference(post: WordPressPost): RelatedPostReference {
  return toRelatedContentReference(post);
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
 * Shared configuration for reference resolvers.
 */
interface ClientReferenceResolverConfig<TItem, TReference extends { id: number }> {
  batchFetch?: (ids: number[]) => Promise<TItem[]>;
  singleFetch: (id: number) => PromiseLike<TItem | null | undefined>;
  toReference: (item: TItem) => TReference;
}

/**
 * Shared base for resolving lightweight relation references.
 */
abstract class BaseReferenceResolver<TItem, TReference extends { id: number }> {
  protected constructor(
    protected readonly toReference: (item: TItem) => TReference,
  ) {}

  /**
   * Fetches one item by numeric ID.
   */
  protected abstract fetchOne(id: number): PromiseLike<TItem | null | undefined>;

  /**
   * Fetches many items in one request when supported.
   */
  protected async fetchMany(_ids: number[]): Promise<TItem[] | null> {
    return null;
  }

  /**
   * Orders resolved references to match the caller's requested IDs.
   */
  private orderResolvedReferences(ids: number[], references: TReference[]): TReference[] {
    const lookup = new Map<number, TReference>();

    for (const reference of references) {
      lookup.set(reference.id, reference);
    }

    return ids
      .map((id) => lookup.get(id))
      .filter((reference): reference is TReference => reference !== undefined);
  }

  /**
   * Resolves many references, preferring one batch request when available.
   */
  async resolveMany(ids: number[]): Promise<TReference[]> {
    if (ids.length === 0) {
      return [];
    }

    const requestedIds = Array.from(new Set(ids.filter((id) => id > 0)));

    if (requestedIds.length === 0) {
      return [];
    }

    const batchItems = await this.fetchMany(requestedIds).catch(() => null);

    if (batchItems) {
      return this.orderResolvedReferences(ids, batchItems.map(this.toReference));
    }

    const settled = await Promise.allSettled(
      requestedIds.map((id) => this.fetchOne(id)),
    );

    const references: TReference[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value != null) {
        references.push(this.toReference(result.value));
      }
    }

    return this.orderResolvedReferences(ids, references);
  }

  /**
   * Resolves one reference from a numeric ID with error tolerance.
   */
  async resolveOne(id: number): Promise<TReference | null> {
    if (id <= 0) {
      return null;
    }

    try {
      const item = await this.fetchOne(id);
      if (item == null) {
        return null;
      }
      return this.toReference(item);
    } catch {
      return null;
    }
  }
}

/**
 * Client-backed reference resolver with optional batch fetch support.
 */
class ClientReferenceResolver<TItem, TReference extends { id: number }>
  extends BaseReferenceResolver<TItem, TReference> {
  constructor(private readonly config: ClientReferenceResolverConfig<TItem, TReference>) {
    super(config.toReference);
  }

  protected override fetchOne(id: number): PromiseLike<TItem | null | undefined> {
    return this.config.singleFetch(id);
  }

  protected override async fetchMany(ids: number[]): Promise<TItem[] | null> {
    if (!this.config.batchFetch) {
      return null;
    }

    return this.config.batchFetch(ids);
  }
}

/**
 * Creates a resolver for lightweight post references.
 */
function createPostReferenceResolver(
  client: PostRelationClient,
): ClientReferenceResolver<WordPressPost, RelatedPostReference> {
  const posts = client.content<WordPressPost>('posts');

  return new ClientReferenceResolver<WordPressPost, RelatedPostReference>({
    singleFetch: (id) => posts.item(id).then(post => post ?? null),
    toReference: toRelatedPostReference,
  });
}

/**
 * Creates a resolver for lightweight content references when the client supports them.
 */
function createContentReferenceResolver(
  client: PostRelationClient,
  resource: string,
): ClientReferenceResolver<WordPressContent, RelatedContentReference> | null {
  const resourceClient = client.content<WordPressContent>(resource);

  return new ClientReferenceResolver<WordPressContent, RelatedContentReference>({
    singleFetch: (id) => resourceClient.item(id).then(post => post ?? null),
    toReference: toRelatedContentReference,
  });
}

/**
 * Creates a resolver for lightweight term references through the shared terms API.
 */
function createTermReferenceResolver(
  client: PostRelationClient,
  resource: string,
): ClientReferenceResolver<WordPressCategory, RelatedTermReference> {
  const resourceClient = client.terms<WordPressCategory>(resource);

  return new ClientReferenceResolver<WordPressCategory, RelatedTermReference>({
    batchFetch: (requestedIds) => resourceClient.list({ include: requestedIds }),
    singleFetch: (id) => resourceClient.item(id),
    toReference: toRelatedTermReference,
  });
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

  const resolver = createContentReferenceResolver(client, resource);

  if (!resolver) {
    return [];
  }

  return resolver.resolveMany(ids);
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

  const resolver = createContentReferenceResolver(client, resource);

  if (!resolver) {
    return null;
  }

  return resolver.resolveOne(id);
}

/**
 * Resolves many post references from numeric IDs.
 */
export async function resolvePostReferences(
  client: PostRelationClient,
  ids: number[],
): Promise<RelatedPostReference[]> {
  return createPostReferenceResolver(client).resolveMany(ids);
}

/**
 * Resolves one post reference from a numeric ID.
 */
export async function resolvePostReference(
  client: PostRelationClient,
  id: number,
): Promise<RelatedPostReference | null> {
  return createPostReferenceResolver(client).resolveOne(id);
}

/**
 * Resolves many term references from numeric IDs for any taxonomy resource.
 */
export async function resolveTermReferences(
  client: PostRelationClient,
  resource: string,
  ids: number[],
): Promise<RelatedTermReference[]> {
  return createTermReferenceResolver(client, resource).resolveMany(ids);
}

/**
 * Resolves one term reference from a numeric ID for any taxonomy resource.
 */
export async function resolveTermReference(
  client: PostRelationClient,
  resource: string,
  id: number,
): Promise<RelatedTermReference | null> {
  return createTermReferenceResolver(client, resource).resolveOne(id);
}
