/**
 * Public barrel for relation resolver primitives, factories, and extension contracts.
 */
export type {
  EmbeddedDataExtractor,
  RelationFallbackResolver,
  CustomRelationConfig,
  IdCollectionRelationOptions,
  IdSingleRelationOptions,
  LinkedEmbeddedCollectionRelationOptions,
  LinkedEmbeddedSingleRelationOptions,
  PostRelationClient,
  RelatedContentReference,
  RelatedPostReference,
  RelatedTermReference,
} from './relation-contracts.js';

export {
  CustomRelationRegistry,
  customRelationRegistry,
  extractEmbeddedData,
  createArrayExtractor,
  createSingleExtractor,
  defaultParseReferenceId,
  defaultParseLinkId,
  getEmbeddedRelationItems,
  getLinkedRelationIds,
} from './relation-contracts.js';

export {
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
  createIdCollectionRelation,
  createIdSingleRelation,
} from './relation-definitions.js';

export {
  toRelatedPostReference,
  toRelatedContentReference,
  toRelatedTermReference,
  resolveContentReference,
  resolveContentReferences,
  resolvePostReference,
  resolvePostReferences,
  resolveTermReference,
  resolveTermReferences,
} from './relation-reference-resolvers.js';
