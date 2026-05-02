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
 *
 * Every tool factory accepts an optional `fetch` callback that replaces the
 * default WordPress client call. The callback receives the fully resolved,
 * normalised arguments after `fixedArgs` and schema defaults have been applied.
 * This is the extension point for caches, live loaders, proxies, and custom
 * request pipelines — for both reads and writes.
 */

// Abilities
export {
  createAbilityTools,
  executeAbilityTool,
  executeDeleteAbilityTool,
  executeGetAbilityTool,
  executeRunAbilityTool,
  getAbilitiesTool,
  getAbilityTool,
} from "./abilities.js";
// Gutenberg blocks — universal read/write for any post-like resource
export { getBlocksTool, setBlocksTool } from "./blocks.js";
// Generic content
export {
  deleteContentTool,
  getContentCollectionTool,
  getContentTool,
  saveContentTool,
} from "./content.js";
// Schema introspection
export {
  type DescribeResourceResourceKind,
  type DescribeResourceToolInclude,
  type DescribeResourceToolOptions,
  describeResourceTool,
} from "./describe.js";
export type {
  ContentItemResult,
  WordPressAIToolErrorResult,
} from "./factories.js";
// Generic first-class resources
export {
  deleteResourceTool,
  getResourceCollectionTool,
  getResourceTool,
  saveResourceTool,
} from "./resources.js";
// Singleton settings
export { getSettingsTool, updateSettingsTool } from "./settings.js";
// Generic taxonomies
export {
  deleteTermTool,
  getTermCollectionTool,
  getTermTool,
  saveTermTool,
} from "./terms.js";
// Types
export type {
  AbilityToolFactoryOptions,
  BlocksGetToolOptions,
  BlocksSetToolOptions,
  CatalogMutationToolFactoryOptions,
  CatalogToolFactoryOptions,
  ContentCollectionToolOptions,
  ContentDeleteToolOptions,
  ContentGetToolOptions,
  ContentSaveToolOptions,
  CreateAbilityToolsOptions,
  GenericMutationToolFactoryOptions,
  GenericResourceToolFactoryOptions,
  MutationToolFactoryOptions,
  ResourceCollectionToolOptions,
  ResourceDeleteToolOptions,
  ResourceGetToolOptions,
  ResourceSaveToolOptions,
  SettingsGetToolOptions,
  TermCollectionToolOptions,
  TermDeleteToolOptions,
  TermGetToolOptions,
  TermSaveToolOptions,
  ToolFactoryOptions,
} from "./types.js";
