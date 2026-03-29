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
  blockTypeSchema as zodBlockTypeSchema,
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
  parsedBlockSchema as zodParsedBlockSchema,
  postLikeWordPressSchema as zodPostLikeWordPressSchema,
  postSchema as zodPostSchema,
  postWriteBaseSchema as zodPostWriteBaseSchema,
  searchResultSchema as zodSearchResultSchema,
  settingsSchema as zodSettingsSchema,
  tagSchema as zodTagSchema,
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
 * Converts one object of Zod schemas to Standard Schema exports with matching keys.
 */
function toStandardSchemaMap<TSchemas extends Record<string, z.ZodType>>(
  schemas: TSchemas,
): {
  [TKey in keyof TSchemas]: WordPressStandardSchema<
    z.output<TSchemas[TKey]>,
    z.input<TSchemas[TKey]>
  >;
} {
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, asStandardSchema(schema)]),
  ) as {
    [TKey in keyof TSchemas]: WordPressStandardSchema<
      z.output<TSchemas[TKey]>,
      z.input<TSchemas[TKey]>
    >;
  };
}

/**
 * Standard Schema exports for WordPress core resource payloads.
 */
const standardSchemas = toStandardSchemaMap({
  baseWordPressSchema: zodBaseWordPressSchema,
  postLikeWordPressSchema: zodPostLikeWordPressSchema,
  contentWordPressSchema: zodContentWordPressSchema,
  postSchema: zodPostSchema,
  pageSchema: zodPageSchema,
  mediaSchema: zodMediaSchema,
  categorySchema: zodCategorySchema,
  tagSchema: zodTagSchema,
  embeddedMediaSchema: zodEmbeddedMediaSchema,
  abilityAnnotationsSchema: zodAbilityAnnotationsSchema,
  abilitySchema: zodAbilitySchema,
  abilityCategorySchema: zodAbilityCategorySchema,
  blockTypeSchema: zodBlockTypeSchema,
  authorSchema: zodAuthorSchema,
  commentSchema: zodCommentSchema,
  updatePostFieldsSchema: zodUpdatePostFieldsSchema,
  postWriteBaseSchema: zodPostWriteBaseSchema,
  jwtAuthTokenResponseSchema: zodJwtAuthTokenResponseSchema,
  jwtAuthErrorResponseSchema: zodJwtAuthErrorResponseSchema,
  jwtAuthValidationResponseSchema: zodJwtAuthValidationResponseSchema,
  parsedBlockSchema: zodParsedBlockSchema,
  wordPressErrorSchema: zodWordPressErrorSchema,
  settingsSchema: zodSettingsSchema,
  searchResultSchema: zodSearchResultSchema,
});

export const {
  baseWordPressSchema,
  postLikeWordPressSchema,
  contentWordPressSchema,
  postSchema,
  pageSchema,
  mediaSchema,
  categorySchema,
  tagSchema,
  embeddedMediaSchema,
  abilityAnnotationsSchema,
  abilitySchema,
  abilityCategorySchema,
  blockTypeSchema,
  authorSchema,
  commentSchema,
  updatePostFieldsSchema,
  postWriteBaseSchema,
  jwtAuthTokenResponseSchema,
  jwtAuthErrorResponseSchema,
  jwtAuthValidationResponseSchema,
  parsedBlockSchema,
  wordPressErrorSchema,
  settingsSchema,
  searchResultSchema,
} = standardSchemas;

/**
 * Standard Schema exports for ability execution input wrappers.
 */
const abilityInputSchemas = toStandardSchemaMap({
  getAbilityInputSchema: zodGetAbilityInputSchema,
  runAbilityInputSchema: zodRunAbilityInputSchema,
  deleteAbilityInputSchema: zodDeleteAbilityInputSchema,
});

export const {
  getAbilityInputSchema,
  runAbilityInputSchema,
  deleteAbilityInputSchema,
} = abilityInputSchemas;
