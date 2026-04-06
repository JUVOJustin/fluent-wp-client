/**
 * AI SDK tool exports for WordPress client integration.
 *
 * Each exported tool factory accepts a `WordPressClient` instance and an
 * optional configuration object. Developers compose tools manually by
 * importing individual factories and adding them to AI SDK's `tools` object.
 *
 * Per resource the surface is intentionally lean:
 *
 * - **One collection tool** handles search, filtering, pagination, sorting,
 *   and field selection. The model pages through results on its own.
 * - **One single-getter tool** accepts either `id` or `slug` and, for
 *   post-like resources, can optionally expand raw content and blocks.
 * - **Mutation tools** (create, update, delete) map 1:1 to write operations.
 */

// Types
export type {
  ToolFactoryOptions,
  MutationToolFactoryOptions,
  CatalogToolFactoryOptions,
  CatalogMutationToolFactoryOptions,
  ContentToolFactoryOptions,
  ContentMutationToolFactoryOptions,
  TermToolFactoryOptions,
  TermMutationToolFactoryOptions,
  AbilityToolFactoryOptions,
  CreateAbilityToolsOptions,
  GenericResourceToolFactoryOptions,
  GenericMutationToolFactoryOptions,
} from './types.js';

export type { ContentItemResult, WordPressAIToolErrorResult } from './factories.js';

// Singleton settings
export {
  getSettingsTool,
  updateSettingsTool,
} from './settings.js';

// Generic content
export {
  getContentCollectionTool,
  getContentTool,
  createContentTool,
  updateContentTool,
  deleteContentTool,
} from './content.js';

// Generic taxonomies
export {
  getTermCollectionTool,
  getTermTool,
  createTermTool,
  updateTermTool,
  deleteTermTool,
} from './terms.js';

// Generic first-class resources
export {
  getResourceCollectionTool,
  getResourceTool,
  createResourceTool,
  updateResourceTool,
  deleteResourceTool,
  type ResourceToolFactoryOptions,
  type ResourceMutationToolFactoryOptions,
} from './resources.js';

// Abilities
export {
  getAbilitiesTool,
  getAbilityTool,
  executeGetAbilityTool,
  executeRunAbilityTool,
  executeDeleteAbilityTool,
  createAbilityTools,
} from './abilities.js';

// Gutenberg blocks — universal read/write for any post-like resource
export {
  getBlocksTool,
  setBlocksTool,
} from './blocks.js';
