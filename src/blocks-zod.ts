/**
 * Native Zod exports for the block-focused subpackage.
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
export {
  blockTypeSchema,
  parsedBlockSchema,
  type WordPressBlockType,
  type WordPressParsedBlock,
} from "./schemas.js";
export type { BlockTypesFilter } from "./types/filters.js";
export type { BlocksResourceClient } from "./types/resources.js";
export * from "./zod.js";
