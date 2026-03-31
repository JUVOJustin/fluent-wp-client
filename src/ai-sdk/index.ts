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
  GenericResourceToolFactoryOptions,
  GenericMutationToolFactoryOptions,
} from './types.js';

export type { ContentItemResult, WordPressAIToolErrorResult } from './factories.js';

// Posts
export {
  getPostsTool,
  getPostTool,
  createPostTool,
  updatePostTool,
  deletePostTool,
} from './posts.js';

// Pages
export {
  getPagesTool,
  getPageTool,
  createPageTool,
  updatePageTool,
  deletePageTool,
} from './pages.js';

// Media
export {
  getMediaTool,
  getMediaItemTool,
  deleteMediaTool,
} from './media.js';

// Categories
export {
  getCategoriesTool,
  getCategoryTool,
  createCategoryTool,
  updateCategoryTool,
  deleteCategoryTool,
} from './categories.js';

// Tags
export {
  getTagsTool,
  getTagTool,
  createTagTool,
  updateTagTool,
  deleteTagTool,
} from './tags.js';

// Users
export {
  getUsersTool,
  getUserTool,
  createUserTool,
  updateUserTool,
  deleteUserTool,
} from './users.js';

// Comments
export {
  getCommentsTool,
  getCommentTool,
  createCommentTool,
  updateCommentTool,
  deleteCommentTool,
} from './comments.js';

// Settings
export {
  getSettingsTool,
  updateSettingsTool,
} from './settings.js';

// Generic content (custom post types)
export {
  getContentCollectionTool,
  getContentTool,
  createContentTool,
  updateContentTool,
  deleteContentTool,
} from './content.js';

// Generic terms (custom taxonomies)
export {
  getTermCollectionTool,
  getTermTool,
  createTermTool,
  updateTermTool,
  deleteTermTool,
} from './terms.js';

// Abilities
export {
  getAbilitiesTool,
  getAbilityTool,
  executeGetAbilityTool,
  executeRunAbilityTool,
  executeDeleteAbilityTool,
} from './abilities.js';

// Gutenberg blocks — universal read/write for any post-like resource
export {
  getBlocksTool,
  setBlocksTool,
} from './blocks.js';
