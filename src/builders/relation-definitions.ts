import type { WordPressContent, WordPressPostLike } from '../schemas.js';
import {
  createArrayExtractor,
  createSingleExtractor,
  defaultParseLinkId,
  defaultParseReferenceId,
  getEmbeddedRelationItems,
  type CustomRelationConfig,
  type IdCollectionRelationOptions,
  type IdSingleRelationOptions,
  type LinkedEmbeddedCollectionRelationOptions,
  type LinkedEmbeddedSingleRelationOptions,
  type PostRelationClient,
  type RelationFallbackResolver,
} from './relation-contracts.js';

/**
 * Internal options for resolving one shared link/embed relation bucket.
 */
interface LinkedEmbeddedResolverOptions<T extends { id: number }> {
  embeddedKey: string;
  linksKey: string;
  extractItem: (item: unknown) => T | null;
  parseLinkId: (link: Record<string, unknown>) => number | null;
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
}

/**
 * Internal options for resolving one single shared link/embed relation.
 */
interface LinkedEmbeddedSingleResolverOptions<T extends { id: number }>
  extends Omit<LinkedEmbeddedResolverOptions<T>, 'resolveMany'> {
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
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
 * Base class for reusable relation definition objects.
 */
abstract class BaseRelationDefinition<TResult>
  implements CustomRelationConfig<TResult>, RelationFallbackResolver<TResult> {
  readonly fallbackResolver: RelationFallbackResolver<TResult> = this;

  protected constructor(
    public readonly name: string,
    public readonly embeddedKey: string,
    public readonly requiredFields?: string[],
    public readonly embedParam?: string,
  ) {}

  abstract extractEmbedded(embeddedData: unknown): TResult | null;

  abstract resolve(
    client: PostRelationClient,
    post: WordPressPostLike,
  ): Promise<TResult>;
}

/**
 * Base class for relation definitions backed by an embedded extractor.
 */
abstract class BaseEmbeddedExtractorRelationDefinition<TResult> extends BaseRelationDefinition<TResult> {
  constructor(
    name: string,
    embeddedKey: string,
    requiredFields: string[] | undefined,
    embedParam: string | undefined,
    private readonly embeddedExtractor: (embeddedData: unknown) => TResult | null,
  ) {
    super(name, embeddedKey, requiredFields, embedParam);
  }

  override extractEmbedded(embeddedData: unknown): TResult | null {
    return this.embeddedExtractor(embeddedData);
  }
}

/**
 * Coordinates embedded, linked, and fallback resolution for one shared bucket.
 */
class LinkedEmbeddedRelationResolver<T extends { id: number }> {
  private readonly embeddedLookup: Map<number, T>;
  private readonly linkLookup: Map<number, string>;

  constructor(
    private readonly client: PostRelationClient,
    private readonly content: WordPressContent,
    private readonly options: LinkedEmbeddedResolverOptions<T>,
  ) {
    this.embeddedLookup = this.buildEmbeddedLookup();
    this.linkLookup = this.buildLinkedLookup();
  }

  /**
   * Builds one embedded-item lookup for the configured shared bucket.
   */
  private buildEmbeddedLookup(): Map<number, T> {
    const lookup = new Map<number, T>();

    for (const item of getEmbeddedRelationItems(this.content, this.options.embeddedKey, this.options.extractItem)) {
      lookup.set(item.id, item);
    }

    return lookup;
  }

  /**
   * Builds one linked-item href lookup for the configured shared bucket.
   */
  private buildLinkedLookup(): Map<number, string> {
    const links = (this.content as { _links?: Record<string, unknown> })._links?.[this.options.linksKey];

    if (!Array.isArray(links)) {
      return new Map<number, string>();
    }

    const lookup = new Map<number, string>();

    for (const item of links as Array<Record<string, unknown>>) {
      const href = typeof item.href === 'string' ? item.href : undefined;
      const id = this.options.parseLinkId(item);

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
  private async fetchLinkedItemByHref(href: string): Promise<T | null> {
    if (!this.client.request) {
      return null;
    }

    try {
      const { data, response } = await this.client.request<unknown>({
        endpoint: href,
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      return this.options.extractItem(data);
    } catch {
      return null;
    }
  }

  /**
   * Fetches one linked relation item when a matching href is available.
   */
  private async fetchLinkedItem(id: number): Promise<T | null> {
    const href = this.linkLookup.get(id);

    if (!href) {
      return null;
    }

    return this.fetchLinkedItemByHref(href);
  }

  /**
   * Resolves the last missing IDs through the optional fallback resolver.
   */
  private async resolveMissingItems(ids: number[]): Promise<T[]> {
    if (ids.length === 0 || !this.options.resolveMany) {
      return [];
    }

    return this.options.resolveMany(this.client, ids);
  }

  /**
   * Resolves many relation items while preserving the caller's requested order.
   */
  async resolveMany(ids: number[]): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }

    const requestedIds = Array.from(new Set(ids));
    const resolved = new Map<number, T>();

    for (const id of requestedIds) {
      const embeddedItem = this.embeddedLookup.get(id);

      if (embeddedItem) {
        resolved.set(id, embeddedItem);
      }
    }

    const linkedIds = requestedIds.filter((id) => !resolved.has(id) && this.linkLookup.has(id));
    const linkedItems = await Promise.all(
      linkedIds.map(async (id) => ({
        id,
        item: await this.fetchLinkedItem(id),
      })),
    );

    for (const linkedItem of linkedItems) {
      if (linkedItem.item) {
        resolved.set(linkedItem.id, linkedItem.item);
      }
    }

    const missingIds = requestedIds.filter((id) => !resolved.has(id));

    for (const item of await this.resolveMissingItems(missingIds)) {
      resolved.set(item.id, item);
    }

    return ids
      .map((id) => resolved.get(id))
      .filter((item): item is T => item !== undefined);
  }
}

/**
 * Base class for relations backed by shared `_links` / `_embedded` buckets.
 */
abstract class BaseLinkedEmbeddedRelationDefinition<
  T extends { id: number },
  TResult,
> extends BaseRelationDefinition<TResult> {
  protected readonly linksKey: string;
  protected readonly extractItem: (item: unknown) => T | null;
  protected readonly parseReferenceId: (value: unknown) => number | null;
  protected readonly parseLinkId: (link: Record<string, unknown>) => number | null;

  protected constructor(
    options: {
      name: string;
      embeddedKey: string;
      linksKey: string;
      extractItem: (item: unknown) => T | null;
      parseReferenceId: (value: unknown) => number | null;
      parseLinkId: (link: Record<string, unknown>) => number | null;
      requiredFields?: string[];
      embedParam?: string;
    },
  ) {
    super(options.name, options.embeddedKey, options.requiredFields, options.embedParam);
    this.linksKey = options.linksKey;
    this.extractItem = options.extractItem;
    this.parseReferenceId = options.parseReferenceId;
    this.parseLinkId = options.parseLinkId;
  }

  override extractEmbedded(): TResult | null {
    return null;
  }

  protected async resolveCollection(
    client: PostRelationClient,
    content: WordPressContent,
    ids: number[],
    resolveMany?: (relationClient: PostRelationClient, relationIds: number[]) => Promise<T[]>,
  ): Promise<T[]> {
    return new LinkedEmbeddedRelationResolver(client, content, {
      embeddedKey: this.embeddedKey,
      linksKey: this.linksKey,
      extractItem: this.extractItem,
      parseLinkId: this.parseLinkId,
      resolveMany,
    }).resolveMany(ids);
  }
}

/**
 * Class-backed collection relation that falls back to numeric reference IDs.
 */
class IdCollectionRelationDefinition<T>
  extends BaseEmbeddedExtractorRelationDefinition<T[]> {
  constructor(private readonly options: IdCollectionRelationOptions<T>) {
    super(
      options.name,
      options.embeddedKey,
      options.requiredFields,
      undefined,
      createArrayExtractor(options.extractEmbeddedItem),
    );
  }

  override async resolve(client: PostRelationClient, post: WordPressContent): Promise<T[]> {
    const ids = this.options.getIds(post);

    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const validIds = Array.from(
      new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0)),
    );

    if (validIds.length === 0) {
      return [];
    }

    return this.options.resolveMany(client, validIds);
  }
}

/**
 * Class-backed single relation that falls back to one numeric reference ID.
 */
class IdSingleRelationDefinition<T>
  extends BaseEmbeddedExtractorRelationDefinition<T | null> {
  constructor(private readonly options: IdSingleRelationOptions<T>) {
    super(
      options.name,
      options.embeddedKey,
      options.requiredFields,
      undefined,
      createSingleExtractor(options.extractEmbeddedItem),
    );
  }

  override async resolve(client: PostRelationClient, post: WordPressContent): Promise<T | null> {
    const id = this.options.getId(post);

    if (typeof id !== 'number') {
      return null;
    }

    return this.options.resolveOne(client, id);
  }
}

/**
 * Class-backed collection relation for shared `_links` / `_embedded` buckets.
 */
class LinkedEmbeddedCollectionRelationDefinition<T extends { id: number }>
  extends BaseLinkedEmbeddedRelationDefinition<T, T[]> {
  constructor(private readonly options: LinkedEmbeddedCollectionRelationOptions<T>) {
    super({
      name: options.name,
      embeddedKey: options.embeddedKey,
      linksKey: options.linksKey ?? options.embeddedKey,
      extractItem: options.extractItem,
      parseReferenceId: options.parseReferenceId ?? defaultParseReferenceId,
      parseLinkId: options.parseLinkId ?? defaultParseLinkId,
      requiredFields: options.requiredFields,
    });
  }

  override async resolve(client: PostRelationClient, post: WordPressContent): Promise<T[]> {
    return this.resolveCollection(
      client,
      post,
      normalizeReferenceIds(this.options.getIds(post), this.parseReferenceId),
      this.options.resolveMany,
    );
  }
}

/**
 * Class-backed single relation for shared `_links` / `_embedded` buckets.
 */
class LinkedEmbeddedSingleRelationDefinition<T extends { id: number }>
  extends BaseLinkedEmbeddedRelationDefinition<T, T | null> {
  constructor(private readonly options: LinkedEmbeddedSingleRelationOptions<T>) {
    super({
      name: options.name,
      embeddedKey: options.embeddedKey,
      linksKey: options.linksKey ?? options.embeddedKey,
      extractItem: options.extractItem,
      parseReferenceId: options.parseReferenceId ?? defaultParseReferenceId,
      parseLinkId: options.parseLinkId ?? defaultParseLinkId,
      requiredFields: options.requiredFields,
    });
  }

  override async resolve(client: PostRelationClient, post: WordPressContent): Promise<T | null> {
    const id = normalizeReferenceIds(this.options.getId(post), this.parseReferenceId)[0] ?? null;

    if (id === null) {
      return null;
    }

    const [resolved] = await this.resolveCollection(
      client,
      post,
      [id],
      this.options.resolveOne
        ? async (relationClient, ids) => {
          const item = await this.options.resolveOne?.(relationClient, ids[0] ?? 0);
          return item ? [item] : [];
        }
        : undefined,
    );

    return resolved ?? null;
  }
}

/**
 * Creates a collection relation for APIs that expose one shared `_links` / `_embedded` bucket.
 */
export function createLinkedEmbeddedCollectionRelation<T extends { id: number }>(
  options: LinkedEmbeddedCollectionRelationOptions<T>,
): CustomRelationConfig<T[]> {
  return new LinkedEmbeddedCollectionRelationDefinition(options);
}

/**
 * Creates a single relation for APIs that expose one shared `_links` / `_embedded` bucket.
 */
export function createLinkedEmbeddedSingleRelation<T extends { id: number }>(
  options: LinkedEmbeddedSingleRelationOptions<T>,
): CustomRelationConfig<T | null> {
  return new LinkedEmbeddedSingleRelationDefinition(options);
}

/**
 * Creates a collection relation that falls back to numeric reference IDs.
 */
export function createIdCollectionRelation<T>(
  options: IdCollectionRelationOptions<T>,
): CustomRelationConfig<T[]> {
  return new IdCollectionRelationDefinition(options);
}

/**
 * Creates a single-item relation that falls back to one numeric reference ID.
 */
export function createIdSingleRelation<T>(
  options: IdSingleRelationOptions<T>,
): CustomRelationConfig<T | null> {
  return new IdSingleRelationDefinition(options);
}
