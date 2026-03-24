import type { WordPressCategory, WordPressContent, WordPressPost } from '../schemas.js';
import {
  defaultParseReferenceId,
  getEmbeddedRelationItems,
  getLinkedRelationIds,
  resolveContentReference,
  resolveContentReferences,
  resolveTermReference,
  resolveTermReferences,
  toRelatedContentReference,
  toRelatedTermReference,
  type CustomRelationConfig,
  type PostRelationClient,
  type RelatedContentReference,
  type RelatedTermReference,
} from './relation-contracts.js';
import {
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
} from './relation-definitions.js';

/**
 * Lightweight content shape returned by ACF post embeds.
 */
export interface AcfRelatedContent extends RelatedContentReference {}

/**
 * Lightweight term shape returned by ACF taxonomy embeds.
 */
export interface AcfRelatedTerm extends RelatedTermReference {}

/**
 * Shared options for ACF relation helpers.
 */
export interface AcfRelationOptions {
  /**
   * Public relation name used in `.with(...)`.
   */
  relationName: string;

  /**
   * ACF field name stored inside the `acf` response object.
   */
  fieldName: string;

  /**
   * Link key exposed on `_links`.
   */
  linksKey?: string;

  /**
   * Embedded key exposed on `_embedded`.
   */
  embeddedKey?: string;

  /**
   * Response fields that must be preserved for fallback resolution.
   */
  requiredFields?: string[];
}

/**
 * Options for ACF relationship and post_object fields pointing to content items.
 */
export interface AcfContentRelationOptions extends AcfRelationOptions {
  /**
   * Optional fallback REST resource when ACF links are unavailable.
   * Use the endpoint rest base such as `posts`, `pages`, or `books`.
   */
  resource?: string;
}

/**
 * Options for ACF post_object fields.
 */
export interface AcfPostObjectRelationOptions extends AcfContentRelationOptions {
  /**
   * Whether the field stores multiple selected items.
   */
  multiple: boolean;
}

/**
 * Options for ACF taxonomy fields.
 */
export interface AcfTaxonomyRelationOptions extends AcfRelationOptions {
  /**
   * REST resource used to fetch the taxonomy terms when links are unavailable.
   * Use the endpoint rest base such as `categories`, `tags`, or `genre`.
   */
  resource: string;

  /**
   * Whether the field stores multiple selected terms.
   */
  multiple: boolean;
}

/**
 * Default ACF link key for post-like relations.
 */
export const DEFAULT_ACF_POSTS_LINK_KEY = 'acf:post';

/**
 * Default ACF link key for taxonomy relations.
 */
export const DEFAULT_ACF_TERMS_LINK_KEY = 'acf:term';

/**
 * Default response fields required for ACF fallback hydration.
 */
const DEFAULT_ACF_REQUIRED_FIELDS = ['acf', '_links'];

/**
 * Fully resolved ACF relation settings after defaults are applied.
 */
interface ResolvedAcfRelationOptions {
  relationName: string;
  fieldName: string;
  linksKey: string;
  embeddedKey: string;
  requiredFields: string[];
}

/**
 * Internal shared options for ACF relation factory routing.
 */
interface AcfSharedBucketRelationOptions<T extends { id: number }> extends ResolvedAcfRelationOptions {
  multiple: boolean;
  extractItem: (item: unknown) => T | null;
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
}

type AcfResolveMany<T> = (
  client: PostRelationClient,
  resource: string,
  ids: number[],
) => Promise<T[]>;

type AcfResolveOne<T> = (
  client: PostRelationClient,
  resource: string,
  id: number,
) => Promise<T | null>;

/**
 * Reads one ACF object map from a content response.
 */
function getAcfRecord(content: WordPressContent): Record<string, unknown> {
  const acf = (content as { acf?: Record<string, unknown> | unknown[] }).acf;

  if (!acf || Array.isArray(acf) || typeof acf !== 'object') {
    return {};
  }

  return acf;
}

/**
 * Normalizes one ACF relation field value to a numeric ID.
 */
function parseAcfReferenceId(value: unknown): number | null {
  const directId = defaultParseReferenceId(value);

  if (directId !== null) {
    return directId;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const colonMatch = value.match(/:(\d+)$/);

  if (!colonMatch) {
    return null;
  }

  return defaultParseReferenceId(colonMatch[1]);
}

/**
 * Applies shared ACF defaults for link keys, embed keys, and required fields.
 */
function resolveAcfRelationOptions(
  options: AcfRelationOptions,
  defaultLinksKey: string,
): ResolvedAcfRelationOptions {
  const linksKey = options.linksKey ?? defaultLinksKey;

  return {
    relationName: options.relationName,
    fieldName: options.fieldName,
    linksKey,
    embeddedKey: options.embeddedKey ?? linksKey,
    requiredFields: options.requiredFields ?? [...DEFAULT_ACF_REQUIRED_FIELDS],
  };
}

/**
 * Normalizes one embedded content item to a lightweight DTO.
 */
function extractAcfReference<T>(
  item: unknown,
  isSupported: (record: Record<string, unknown>) => boolean,
  toReference: (record: Record<string, unknown>) => T,
): T | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;

  if (!isSupported(record)) {
    return null;
  }

  return toReference(record);
}

/**
 * Normalizes one embedded content item to a lightweight DTO.
 */
function extractAcfContent(item: unknown): AcfRelatedContent | null {
  return extractAcfReference(
    item,
    (content) => typeof content.id === 'number',
    (content) => toRelatedContentReference(content as WordPressContent),
  );
}

/**
 * Normalizes one embedded term item to a lightweight DTO.
 */
function extractAcfTerm(item: unknown): AcfRelatedTerm | null {
  return extractAcfReference(
    item,
    (term) => typeof term.id === 'number' && typeof term.taxonomy === 'string',
    (term) => toRelatedTermReference(term as WordPressCategory),
  );
}

function createAcfFallbackResolvers<T>(
  resource: string,
  resolveMany: AcfResolveMany<T>,
  resolveOne: AcfResolveOne<T>,
): {
  resolveMany: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
  resolveOne: (client: PostRelationClient, id: number) => Promise<T | null>;
};

function createAcfFallbackResolvers<T>(
  resource: string | undefined,
  resolveMany: AcfResolveMany<T>,
  resolveOne: AcfResolveOne<T>,
): {
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
};

/**
 * Adapts one resource-aware relation resolver pair to ACF field callbacks.
 */
function createAcfFallbackResolvers<T>(
  resource: string | undefined,
  resolveMany: AcfResolveMany<T>,
  resolveOne: AcfResolveOne<T>,
): {
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>;
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>;
} {
  if (!resource) {
    return {};
  }

  return {
    resolveMany: (client, ids) => resolveMany(client, resource, ids),
    resolveOne: (client, id) => resolveOne(client, resource, id),
  };
}

/**
 * Internal shared factory for ACF content/post relation resolvers.
 * Handles the common link/embed collection setup.
 */
function createAcfSharedBucketCollectionRelation<T extends { id: number }>(
  options: ResolvedAcfRelationOptions,
  extractItem: (item: unknown) => T | null,
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<T[]>,
): CustomRelationConfig<T[]> {
  return createLinkedEmbeddedCollectionRelation({
    name: options.relationName,
    embeddedKey: options.embeddedKey,
    linksKey: options.linksKey,
    extractItem,
    getIds: (content) => getAcfRecord(content)[options.fieldName],
    parseReferenceId: parseAcfReferenceId,
    resolveMany,
    requiredFields: options.requiredFields,
  });
}

/**
 * Internal shared factory for ACF content/post single relation resolvers.
 */
function createAcfSharedBucketSingleRelation<T extends { id: number }>(
  options: ResolvedAcfRelationOptions,
  extractItem: (item: unknown) => T | null,
  resolveOne?: (client: PostRelationClient, id: number) => Promise<T | null>,
): CustomRelationConfig<T | null> {
  return createLinkedEmbeddedSingleRelation({
    name: options.relationName,
    embeddedKey: options.embeddedKey,
    linksKey: options.linksKey,
    extractItem,
    getId: (content) => getAcfRecord(content)[options.fieldName],
    parseReferenceId: parseAcfReferenceId,
    resolveOne,
    requiredFields: options.requiredFields,
  });
}

/**
 * Routes one ACF relation through the collection or single shared-bucket helper.
 */
function createAcfSharedBucketRelation<T extends { id: number }>(
  options: AcfSharedBucketRelationOptions<T>,
): CustomRelationConfig<T[] | T | null> {
  if (options.multiple) {
    return createAcfSharedBucketCollectionRelation(options, options.extractItem, options.resolveMany);
  }

  return createAcfSharedBucketSingleRelation(options, options.extractItem, options.resolveOne);
}

/**
 * Creates fallback resolvers for ACF content fields when a REST resource is known.
 */
function createAcfContentFallbackResolvers(resource?: string): {
  resolveMany?: (client: PostRelationClient, ids: number[]) => Promise<AcfRelatedContent[]>;
  resolveOne?: (client: PostRelationClient, id: number) => Promise<AcfRelatedContent | null>;
} {
  return createAcfFallbackResolvers(resource, resolveContentReferences, resolveContentReference);
}

/**
 * Creates fallback resolvers for ACF taxonomy fields.
 */
function createAcfTermFallbackResolvers(resource: string): {
  resolveMany: (client: PostRelationClient, ids: number[]) => Promise<AcfRelatedTerm[]>;
  resolveOne: (client: PostRelationClient, id: number) => Promise<AcfRelatedTerm | null>;
} {
  return createAcfFallbackResolvers(resource, resolveTermReferences, resolveTermReference);
}

/**
 * Creates one ACF relationship-field relation resolver.
 *
 * ACF relationship fields are post_object fields that always allow multiple selections.
 * This is a semantic alias for createAcfPostObjectRelation({ multiple: true }).
 */
export function createAcfRelationshipRelation(
  options: AcfContentRelationOptions,
): CustomRelationConfig<AcfRelatedContent[]> {
  return createAcfPostObjectRelation({
    ...options,
    multiple: true,
  });
}

export function createAcfPostObjectRelation(
  options: AcfPostObjectRelationOptions & { multiple: true },
): CustomRelationConfig<AcfRelatedContent[]>;
export function createAcfPostObjectRelation(
  options: AcfPostObjectRelationOptions & { multiple: false },
): CustomRelationConfig<AcfRelatedContent | null>;

/**
 * Creates one ACF post_object relation resolver.
 *
 * The helper chooses the shared-bucket collection or single factory based on
 * whether the ACF field allows multiple selections.
 */
export function createAcfPostObjectRelation(
  options: AcfPostObjectRelationOptions,
): CustomRelationConfig<AcfRelatedContent[] | AcfRelatedContent | null> {
  const resolved = resolveAcfRelationOptions(options, DEFAULT_ACF_POSTS_LINK_KEY);
  const fallbackResolvers = createAcfContentFallbackResolvers(options.resource);

  return createAcfSharedBucketRelation({
    ...resolved,
    multiple: options.multiple,
    extractItem: extractAcfContent,
    resolveMany: fallbackResolvers.resolveMany,
    resolveOne: fallbackResolvers.resolveOne,
  });
}

export function createAcfTaxonomyRelation(
  options: AcfTaxonomyRelationOptions & { multiple: true },
): CustomRelationConfig<AcfRelatedTerm[]>;
export function createAcfTaxonomyRelation(
  options: AcfTaxonomyRelationOptions & { multiple: false },
): CustomRelationConfig<AcfRelatedTerm | null>;

/**
 * Creates one ACF taxonomy-field relation resolver.
 *
 * The helper routes through the shared-bucket relation factories because ACF
 * groups taxonomy field links and embeds under `acf:term`.
 */
export function createAcfTaxonomyRelation(
  options: AcfTaxonomyRelationOptions,
): CustomRelationConfig<AcfRelatedTerm[] | AcfRelatedTerm | null> {
  const resolved = resolveAcfRelationOptions(options, DEFAULT_ACF_TERMS_LINK_KEY);
  const fallbackResolvers = createAcfTermFallbackResolvers(options.resource);

  return createAcfSharedBucketRelation({
    ...resolved,
    multiple: options.multiple,
    extractItem: extractAcfTerm,
    resolveMany: fallbackResolvers.resolveMany,
    resolveOne: fallbackResolvers.resolveOne,
  });
}

/**
 * Helper to extract linked post-like resource IDs from ACF REST links.
 */
export function getAcfLinkedPostIds(post: WordPressPost, linksKey = DEFAULT_ACF_POSTS_LINK_KEY): number[] {
  return getLinkedRelationIds(post, linksKey);
}

/**
 * Helper to extract embedded post-like resources from ACF embeds.
 */
export function getAcfEmbeddedPosts(post: WordPressPost, embeddedKey = DEFAULT_ACF_POSTS_LINK_KEY): AcfRelatedContent[] {
  return getEmbeddedRelationItems(post, embeddedKey, extractAcfContent);
}

/**
 * Helper to extract linked term IDs from ACF REST links.
 */
export function getAcfLinkedTermIds(post: WordPressPost, linksKey = DEFAULT_ACF_TERMS_LINK_KEY): number[] {
  return getLinkedRelationIds(post, linksKey);
}

/**
 * Helper to extract embedded terms from ACF embeds.
 */
export function getAcfEmbeddedTerms(post: WordPressPost, embeddedKey = DEFAULT_ACF_TERMS_LINK_KEY): AcfRelatedTerm[] {
  return getEmbeddedRelationItems(post, embeddedKey, extractAcfTerm);
}
