import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressContent,
  WordPressMedia,
  WordPressPost,
  WordPressPostLike,
  WordPressTag,
} from '../schemas.js';
import type { WordPressRequestOptions, WordPressRequestResult } from '../types/client.js';
import type { QueryParams } from '../types/resources.js';

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
