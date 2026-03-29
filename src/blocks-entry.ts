/**
 * Portable Gutenberg block helpers and block-aware client extensions.
 */
export * from './index.js';

export { BlockTypesResource } from './resources/block-types.js';

export type {
  BlockTypesFilter,
} from './types/filters.js';

export type {
  BlocksResourceClient,
} from './types/resources.js';

export {
  blockTypeSchema,
  parsedBlockSchema,
} from './standard-schemas.js';

export type {
  WordPressBlockType,
  WordPressParsedBlock,
} from './schemas.js';

export {
  withBlocks,
  BlockContentItemQuery,
  type BlockAwareContentResourceClient,
  type WordPressBlocksClient,
  type WordPressBlocksExtension,
} from './blocks-client.js';

export {
  WordPressBlockValidationError,
  assertValidWordPressBlocks,
  createWordPressBlockJsonSchema,
  createWordPressBlockJsonSchemas,
  loadDefaultWordPressBlockParser,
  parseWordPressBlocks,
  serializeWordPressBlockAttributes,
  serializeWordPressBlockComment,
  serializeWordPressBlocks,
  validateWordPressBlocks,
  type WordPressBlockParser,
  type WordPressBlockJsonSchema,
  type WordPressBlockValidationIssue,
  type WordPressBlockValidationResult,
  type WordPressGetBlocksOptions,
  type WordPressSetBlocksOptions,
  type WordPressValidateBlocksOptions,
} from './blocks.js';
