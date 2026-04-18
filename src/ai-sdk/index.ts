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

// Abilities
export {
	createAbilityTools,
	executeDeleteAbilityTool,
	executeGetAbilityTool,
	executeRunAbilityTool,
	getAbilitiesTool,
	getAbilityTool,
} from "./abilities.js";
// Gutenberg blocks — universal read/write for any post-like resource
export {
	getBlocksTool,
	setBlocksTool,
} from "./blocks.js";
// Generic content
export {
	createContentTool,
	deleteContentTool,
	getContentCollectionTool,
	getContentTool,
	updateContentTool,
} from "./content.js";
export type {
	ContentItemResult,
	WordPressAIToolErrorResult,
} from "./factories.js";
// Generic first-class resources
export {
	createResourceTool,
	deleteResourceTool,
	getResourceCollectionTool,
	getResourceTool,
	type ResourceMutationToolFactoryOptions,
	type ResourceToolFactoryOptions,
	updateResourceTool,
} from "./resources.js";
// Singleton settings
export {
	getSettingsTool,
	updateSettingsTool,
} from "./settings.js";
// Generic taxonomies
export {
	createTermTool,
	deleteTermTool,
	getTermCollectionTool,
	getTermTool,
	updateTermTool,
} from "./terms.js";
// Types
export type {
	AbilityToolFactoryOptions,
	CatalogMutationToolFactoryOptions,
	CatalogToolFactoryOptions,
	ContentMutationToolFactoryOptions,
	ContentToolFactoryOptions,
	CreateAbilityToolsOptions,
	GenericMutationToolFactoryOptions,
	GenericResourceToolFactoryOptions,
	MutationToolFactoryOptions,
	TermMutationToolFactoryOptions,
	TermToolFactoryOptions,
	ToolFactoryOptions,
} from "./types.js";
