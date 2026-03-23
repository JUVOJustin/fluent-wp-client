import type { WordPressCategory, WordPressContent, WordPressPost } from '../schemas.js';
import {
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
  getEmbeddedRelationItems,
  getLinkedRelationIds,
  resolveContentReference,
  resolveContentReferences,
  resolveTermReference,
  resolveTermReferences,
  toRelatedContentReference,
  toRelatedTermReference,
  type CustomRelationConfig,
  type RelatedContentReference,
  type RelatedTermReference,
} from './relation-resolvers.js';

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
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const directId = Number(value);

  if (Number.isInteger(directId) && directId > 0) {
    return directId;
  }

  const colonMatch = value.match(/:(\d+)$/);

  if (!colonMatch) {
    return null;
  }

  const id = Number(colonMatch[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Normalizes one embedded content item to a lightweight DTO.
 */
function extractAcfContent(item: unknown): AcfRelatedContent | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const content = item as Record<string, unknown>;

  if (typeof content.id !== 'number') {
    return null;
  }

  return toRelatedContentReference(content as WordPressContent);
}

/**
 * Normalizes one embedded term item to a lightweight DTO.
 */
function extractAcfTerm(item: unknown): AcfRelatedTerm | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const term = item as Record<string, unknown>;

  if (typeof term.id !== 'number' || typeof term.taxonomy !== 'string') {
    return null;
  }

  return toRelatedTermReference(term as WordPressCategory);
}

/**
 * Creates one ACF relationship-field relation resolver.
 *
 * Internally this uses the shared-bucket link/embed factory because ACF groups
 * all post-like fields under the same `acf:post` relation key.
 */
export function createAcfRelationshipRelation(
  options: AcfContentRelationOptions,
): CustomRelationConfig<AcfRelatedContent[]> {
  const linksKey = options.linksKey ?? DEFAULT_ACF_POSTS_LINK_KEY;
  const embeddedKey = options.embeddedKey ?? linksKey;
  const fallbackResource = options.resource;

  return createLinkedEmbeddedCollectionRelation({
    name: options.relationName,
    embeddedKey,
    linksKey,
    extractItem: extractAcfContent,
    getIds: (content) => getAcfRecord(content)[options.fieldName],
    parseReferenceId: parseAcfReferenceId,
    resolveMany: fallbackResource
      ? (client, ids) => resolveContentReferences(client, fallbackResource, ids)
      : undefined,
    requiredFields: options.requiredFields ?? ['acf', '_links'],
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
  const linksKey = options.linksKey ?? DEFAULT_ACF_POSTS_LINK_KEY;
  const embeddedKey = options.embeddedKey ?? linksKey;
  const fallbackResource = options.resource;

  if (options.multiple) {
    return createLinkedEmbeddedCollectionRelation({
      name: options.relationName,
      embeddedKey,
      linksKey,
      extractItem: extractAcfContent,
      getIds: (content) => getAcfRecord(content)[options.fieldName],
      parseReferenceId: parseAcfReferenceId,
      resolveMany: fallbackResource
        ? (client, ids) => resolveContentReferences(client, fallbackResource, ids)
        : undefined,
      requiredFields: options.requiredFields ?? ['acf', '_links'],
    });
  }

  return createLinkedEmbeddedSingleRelation({
    name: options.relationName,
    embeddedKey,
    linksKey,
    extractItem: extractAcfContent,
    getId: (content) => getAcfRecord(content)[options.fieldName],
    parseReferenceId: parseAcfReferenceId,
    resolveOne: fallbackResource
      ? (client, id) => resolveContentReference(client, fallbackResource, id)
      : undefined,
    requiredFields: options.requiredFields ?? ['acf', '_links'],
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
  const linksKey = options.linksKey ?? DEFAULT_ACF_TERMS_LINK_KEY;
  const embeddedKey = options.embeddedKey ?? linksKey;

  if (options.multiple) {
    return createLinkedEmbeddedCollectionRelation({
      name: options.relationName,
      embeddedKey,
      linksKey,
      extractItem: extractAcfTerm,
      getIds: (content) => getAcfRecord(content)[options.fieldName],
      parseReferenceId: parseAcfReferenceId,
      resolveMany: (client, ids) => resolveTermReferences(client, options.resource, ids),
      requiredFields: options.requiredFields ?? ['acf', '_links'],
    });
  }

  return createLinkedEmbeddedSingleRelation({
    name: options.relationName,
    embeddedKey,
    linksKey,
    extractItem: extractAcfTerm,
    getId: (content) => getAcfRecord(content)[options.fieldName],
    parseReferenceId: parseAcfReferenceId,
    resolveOne: (client, id) => resolveTermReference(client, options.resource, id),
    requiredFields: options.requiredFields ?? ['acf', '_links'],
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
