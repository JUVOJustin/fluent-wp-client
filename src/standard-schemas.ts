import type * as z from 'zod';
import {
  zodDeleteAbilityInputSchema,
  zodGetAbilityInputSchema,
  zodRunAbilityInputSchema,
} from './abilities.js';
import {
  abilityAnnotationsSchema as zodAbilityAnnotationsSchema,
  abilityCategorySchema as zodAbilityCategorySchema,
  abilitySchema as zodAbilitySchema,
  authorSchema as zodAuthorSchema,
  baseWordPressSchema as zodBaseWordPressSchema,
  categorySchema as zodCategorySchema,
  commentSchema as zodCommentSchema,
  contentWordPressSchema as zodContentWordPressSchema,
  embeddedMediaSchema as zodEmbeddedMediaSchema,
  jwtAuthErrorResponseSchema as zodJwtAuthErrorResponseSchema,
  jwtAuthTokenResponseSchema as zodJwtAuthTokenResponseSchema,
  jwtAuthValidationResponseSchema as zodJwtAuthValidationResponseSchema,
  mediaSchema as zodMediaSchema,
  pageSchema as zodPageSchema,
  postLikeWordPressSchema as zodPostLikeWordPressSchema,
  postSchema as zodPostSchema,
  postWriteBaseSchema as zodPostWriteBaseSchema,
  searchResultSchema as zodSearchResultSchema,
  settingsSchema as zodSettingsSchema,
  updatePostFieldsSchema as zodUpdatePostFieldsSchema,
  wordPressErrorSchema as zodWordPressErrorSchema,
} from './schemas.js';
import type { WordPressStandardSchema } from './core/validation.js';

/**
 * Narrows one Zod schema to the Standard Schema surface used by root exports.
 */
function asStandardSchema<TSchema extends z.ZodType>(
  schema: TSchema,
): WordPressStandardSchema<z.output<TSchema>, z.input<TSchema>> {
  return schema as unknown as WordPressStandardSchema<z.output<TSchema>, z.input<TSchema>>;
}

/**
 * Standard Schema exports for WordPress core resource payloads.
 */
export const baseWordPressSchema = asStandardSchema(zodBaseWordPressSchema);
export const postLikeWordPressSchema = asStandardSchema(zodPostLikeWordPressSchema);
export const contentWordPressSchema = asStandardSchema(zodContentWordPressSchema);
export const postSchema = asStandardSchema(zodPostSchema);
export const pageSchema = asStandardSchema(zodPageSchema);
export const mediaSchema = asStandardSchema(zodMediaSchema);
export const categorySchema = asStandardSchema(zodCategorySchema);
export const embeddedMediaSchema = asStandardSchema(zodEmbeddedMediaSchema);
export const abilityAnnotationsSchema = asStandardSchema(zodAbilityAnnotationsSchema);
export const abilitySchema = asStandardSchema(zodAbilitySchema);
export const abilityCategorySchema = asStandardSchema(zodAbilityCategorySchema);
export const authorSchema = asStandardSchema(zodAuthorSchema);
export const commentSchema = asStandardSchema(zodCommentSchema);
export const updatePostFieldsSchema = asStandardSchema(zodUpdatePostFieldsSchema);
export const postWriteBaseSchema = asStandardSchema(zodPostWriteBaseSchema);
export const jwtAuthTokenResponseSchema = asStandardSchema(zodJwtAuthTokenResponseSchema);
export const jwtAuthErrorResponseSchema = asStandardSchema(zodJwtAuthErrorResponseSchema);
export const jwtAuthValidationResponseSchema = asStandardSchema(zodJwtAuthValidationResponseSchema);
export const wordPressErrorSchema = asStandardSchema(zodWordPressErrorSchema);
export const settingsSchema = asStandardSchema(zodSettingsSchema);
export const searchResultSchema = asStandardSchema(zodSearchResultSchema);

/**
 * Standard Schema exports for ability execution input wrappers.
 */
export const getAbilityInputSchema = asStandardSchema(zodGetAbilityInputSchema);
export const runAbilityInputSchema = asStandardSchema(zodRunAbilityInputSchema);
export const deleteAbilityInputSchema = asStandardSchema(zodDeleteAbilityInputSchema);
