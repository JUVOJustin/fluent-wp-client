/**
 * Native Zod exports for the block-focused subpackage.
 */
export * from './zod.js';

export type {
  BlockTypesFilter,
} from './types/filters.js';

export type {
  BlocksResourceClient,
} from './types/resources.js';

export {
  blockTypeSchema,
  parsedBlockSchema,
  type WordPressBlockType,
  type WordPressParsedBlock,
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
