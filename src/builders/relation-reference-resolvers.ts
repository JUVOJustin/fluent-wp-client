import type { WordPressCategory, WordPressContent, WordPressPost } from '../schemas.js';
import type {
  PostRelationClient,
  RelatedContentReference,
  RelatedPostReference,
  RelatedTermReference,
} from './relation-contracts.js';

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
  singleFetch: (id: number) => PromiseLike<TItem>;
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
  protected abstract fetchOne(id: number): PromiseLike<TItem>;

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
      if (result.status === 'fulfilled') {
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

  protected override fetchOne(id: number): PromiseLike<TItem> {
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

  return new ClientReferenceResolver<WordPressContent, RelatedContentReference>({
    singleFetch: (id) => client.getContent!(resource, id),
    toReference: toRelatedContentReference,
  }).resolveMany(ids);
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

  return new ClientReferenceResolver<WordPressContent, RelatedContentReference>({
    singleFetch: (currentId) => client.getContent!(resource, currentId),
    toReference: toRelatedContentReference,
  }).resolveOne(id);
}

/**
 * Resolves many post references from numeric IDs.
 */
export async function resolvePostReferences(
  client: PostRelationClient,
  ids: number[],
): Promise<RelatedPostReference[]> {
  return new ClientReferenceResolver<WordPressPost, RelatedPostReference>({
    singleFetch: (id) => client.getPost(id),
    toReference: toRelatedPostReference,
  }).resolveMany(ids);
}

/**
 * Resolves one post reference from a numeric ID.
 */
export async function resolvePostReference(
  client: PostRelationClient,
  id: number,
): Promise<RelatedPostReference | null> {
  return new ClientReferenceResolver<WordPressPost, RelatedPostReference>({
    singleFetch: (currentId) => client.getPost(currentId),
    toReference: toRelatedPostReference,
  }).resolveOne(id);
}

/**
 * Resolves many term references from numeric IDs for any taxonomy resource.
 */
export async function resolveTermReferences(
  client: PostRelationClient,
  resource: string,
  ids: number[],
): Promise<RelatedTermReference[]> {
  if (!client.getTerm) {
    return [];
  }

  return new ClientReferenceResolver<WordPressCategory, RelatedTermReference>({
    batchFetch: client.getTermCollection
      ? (requestedIds) => client.getTermCollection!(resource, { include: requestedIds })
      : undefined,
    singleFetch: (id) => client.getTerm!(resource, id),
    toReference: toRelatedTermReference,
  }).resolveMany(ids);
}

/**
 * Resolves one term reference from a numeric ID for any taxonomy resource.
 */
export async function resolveTermReference(
  client: PostRelationClient,
  resource: string,
  id: number,
): Promise<RelatedTermReference | null> {
  if (!client.getTerm) {
    return null;
  }

  return new ClientReferenceResolver<WordPressCategory, RelatedTermReference>({
    singleFetch: (currentId) => client.getTerm!(resource, currentId),
    toReference: toRelatedTermReference,
  }).resolveOne(id);
}
