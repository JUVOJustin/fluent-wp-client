/**
 * Portable Gutenberg block helpers and block-aware client extensions.
 */

export {
  assertValidWordPressBlocks,
  createWordPressBlockJsonSchema,
  createWordPressBlockJsonSchemas,
  loadDefaultWordPressBlockParser,
  parseWordPressBlocks,
  serializeWordPressBlockAttributes,
  serializeWordPressBlockComment,
  serializeWordPressBlocks,
  validateWordPressBlocks,
  type WordPressBlockJsonSchema,
  type WordPressBlockParser,
  WordPressBlockValidationError,
  type WordPressBlockValidationIssue,
  type WordPressBlockValidationResult,
  type WordPressGetBlocksOptions,
  type WordPressSetBlocksOptions,
  type WordPressValidateBlocksOptions,
} from "./blocks.js";
export {
  type BlockAwareContentResourceClient,
  BlockContentItemQuery,
  type WordPressBlocksClient,
  type WordPressBlocksExtension,
  withBlocks,
} from "./blocks-client.js";
export * from "./index.js";
export { BlockTypesResource } from "./resources/block-types.js";
export type {
  WordPressBlockType,
  WordPressParsedBlock,
} from "./schemas.js";
export {
  blockTypeSchema,
  parsedBlockSchema,
} from "./standard-schemas.js";
export type { BlockTypesFilter } from "./types/filters.js";
export type { BlocksResourceClient } from "./types/resources.js";
