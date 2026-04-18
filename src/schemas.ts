import { z } from "zod";

/**
 * Shared rendered-text field used by many REST resource payloads.
 */
const renderedTextSchema = z.object({
  rendered: z.string(),
});

/**
 * Rendered-text field that may also expose raw edit-context data.
 */
const editableRenderedTextSchema = renderedTextSchema.extend({
  raw: z.string().optional(),
});

/**
 * Content-like field that may expose raw data and protection state.
 */
const protectedRenderedTextSchema = editableRenderedTextSchema.extend({
  protected: z.boolean(),
});

/**
 * Flexible schema used by WordPress for meta and ACF payloads.
 */
const recordOrArraySchema = z.union([
  z.record(z.string(), z.any()),
  z.array(z.any()),
]);

/**
 * Flexible object schema used for open-ended REST metadata payloads.
 */
const recordSchema = z.record(z.string(), z.any());

/**
 * Shared image size schema used inside media details payloads.
 */
const mediaSizeSchema = z.object({
  file: z.string(),
  filesize: z.number().optional(),
  height: z.number(),
  mime_type: z.string(),
  source_url: z.string(),
  width: z.number(),
});

/**
 * Shared media details schema used by media and embedded media responses.
 */
const mediaDetailsSchema = z.object({
  file: z.string(),
  filesize: z.number().optional(),
  height: z.number(),
  image_meta: z.any(),
  sizes: z.record(z.string(), mediaSizeSchema),
  width: z.number(),
});

/**
 * Base schema shared by all WordPress content response types.
 */
export const baseWordPressSchema = z
  .object({
    _links: z.any(),
    author: z.number(),
    date: z.string(),
    date_gmt: z.string(),
    guid: renderedTextSchema,
    id: z.number(),
    link: z.string().url(),
    meta: recordOrArraySchema.optional(),
    modified: z.string(),
    modified_gmt: z.string(),
    slug: z.string(),
    status: z.string(),
    title: renderedTextSchema,
    type: z.string(),
  })
  .passthrough();

/**
 * Flexible schema for generic post-like resources whose supports may disable
 * title, content, excerpt, author, and other post fields.
 */
export const postLikeWordPressSchema = baseWordPressSchema
  .omit({
    author: true,
    title: true,
  })
  .extend({
    _embedded: z.any().optional(),
    acf: recordOrArraySchema.optional(),
    author: z.number().optional(),
    categories: z.array(z.number()).optional(),
    class_list: z.array(z.string()).optional(),
    comment_status: z.string().optional(),
    content: protectedRenderedTextSchema.optional(),
    excerpt: protectedRenderedTextSchema.optional(),
    featured_media: z.number().optional(),
    format: z.string().optional(),
    menu_order: z.number().optional(),
    parent: z.number().optional(),
    ping_status: z.string().optional(),
    sticky: z.boolean().optional(),
    tags: z.array(z.number()).optional(),
    template: z.string().optional(),
    title: editableRenderedTextSchema.optional(),
  })
  .passthrough();

/**
 * Schema for content types (posts and pages).
 */
export const contentWordPressSchema = baseWordPressSchema.extend({
  _embedded: z.any().optional(),
  acf: recordOrArraySchema.optional(),
  comment_status: z.string(),
  content: protectedRenderedTextSchema,
  excerpt: protectedRenderedTextSchema,
  featured_media: z.number().optional(),
  ping_status: z.string(),
  template: z.string(),
});

/**
 * Default schema for WordPress posts.
 */
export const postSchema = contentWordPressSchema.extend({
  categories: z.array(z.number()).default([]),
  format: z.string(),
  sticky: z.boolean(),
  tags: z.array(z.number()).default([]),
});

/**
 * Default schema for WordPress pages.
 */
export const pageSchema = contentWordPressSchema.extend({
  class_list: z.array(z.string()).default([]),
  menu_order: z.number().default(0),
  parent: z.number().default(0),
});

/**
 * Schema for WordPress media items.
 */
export const mediaSchema = baseWordPressSchema.extend({
  alt_text: z.string(),
  caption: renderedTextSchema,
  comment_status: z.string(),
  description: renderedTextSchema,
  media_details: mediaDetailsSchema,
  media_type: z.string(),
  mime_type: z.string(),
  ping_status: z.string(),
  post: z.number().nullable().optional(),
  source_url: z.string(),
});

/**
 * Schema for WordPress categories and taxonomies.
 */
export const categorySchema = z
  .object({
    _embedded: z.any().optional(),
    _links: z.any(),
    acf: recordOrArraySchema.optional(),
    count: z.number(),
    description: z.string(),
    id: z.number(),
    link: z.string().url(),
    meta: recordOrArraySchema,
    name: z.string(),
    parent: z.number().default(0),
    slug: z.string(),
    taxonomy: z.string(),
  })
  .passthrough();

/**
 * Schema for WordPress tags (same structure as categories, different semantics).
 */
export const tagSchema = categorySchema;

/**
 * Schema for WordPress embedded media in `_embedded` responses.
 */
export const embeddedMediaSchema = z
  .object({
    _links: z.any().optional(),
    acf: z.any().optional(),
    alt_text: z.string(),
    author: z.number(),
    caption: renderedTextSchema,
    date: z.string(),
    featured_media: z.number(),
    id: z.number(),
    link: z.string(),
    media_details: mediaDetailsSchema.extend({
      image_meta: z.any().optional(),
    }),
    media_type: z.string(),
    mime_type: z.string(),
    slug: z.string(),
    source_url: z.string(),
    title: renderedTextSchema,
    type: z.string(),
  })
  .passthrough();

/**
 * Schema for ability execution annotations exposed by WordPress.
 */
export const abilityAnnotationsSchema = z
  .object({
    destructive: z.boolean().optional(),
    idempotent: z.boolean().nullable().optional(),
    instructions: z.string().optional(),
    readonly: z.boolean().optional(),
  })
  .passthrough();

/**
 * Schema for one WordPress ability definition.
 */
export const abilitySchema = z
  .object({
    category: z.string().optional(),
    description: z.string().optional(),
    input_schema: z.any().optional(),
    label: z.string(),
    meta: z
      .object({
        annotations: abilityAnnotationsSchema.optional(),
      })
      .passthrough()
      .optional(),
    name: z.string(),
    output_schema: z.any().optional(),
  })
  .passthrough();

/**
 * Schema for one WordPress ability category.
 */
export const abilityCategorySchema = z
  .object({
    _links: z.any().optional(),
    description: z.string().optional(),
    label: z.string(),
    meta: z.any().optional(),
    slug: z.string(),
  })
  .passthrough();

/**
 * Schema for one block attribute definition returned by `/wp/v2/block-types`.
 */
const blockAttributeDefinitionSchema = z
  .object({
    attribute: z.string().optional(),
    default: z.any().optional(),
    enum: z.array(z.any()).optional(),
    items: z.any().optional(),
    meta: z.string().optional(),
    properties: recordSchema.optional(),
    query: z.record(z.string(), z.any()).optional(),
    role: z.string().optional(),
    selector: z.string().optional(),
    source: z.string().optional(),
    type: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

/**
 * Schema for block type records exposed by `/wp/v2/block-types`.
 */
export const blockTypeSchema = z
  .object({
    ancestor: z.array(z.string()).nullable().optional(),
    api_version: z.number().optional(),
    attributes: z
      .record(z.string(), blockAttributeDefinitionSchema)
      .nullable()
      .optional(),
    category: z.string().nullable().optional(),
    description: z.string().optional(),
    editor_script: z.string().nullable().optional(),
    editor_script_handles: z.array(z.string()).optional(),
    editor_style: z.string().nullable().optional(),
    editor_style_handles: z.array(z.string()).optional(),
    example: z.any().nullable().optional(),
    icon: z.string().nullable().optional(),
    is_dynamic: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
    name: z.string(),
    parent: z.array(z.string()).nullable().optional(),
    provides_context: recordOrArraySchema.optional(),
    script: z.string().nullable().optional(),
    script_handles: z.array(z.string()).optional(),
    selectors: recordOrArraySchema.optional(),
    style: z.string().nullable().optional(),
    style_handles: z.array(z.string()).optional(),
    styles: z.array(z.any()).optional(),
    supports: recordOrArraySchema.optional(),
    textdomain: z.string().nullable().optional(),
    title: z.string(),
    uses_context: z.array(z.string()).optional(),
    variations: z.array(z.any()).optional(),
    view_script: z.string().nullable().optional(),
    view_script_handles: z.array(z.string()).optional(),
  })
  .passthrough();

export interface WordPressParsedBlock {
  attrs: Record<string, unknown> | null;
  blockName: string | null;
  innerBlocks: WordPressParsedBlock[];
  innerContent: Array<string | null>;
  innerHTML: string;
}

/**
 * Schema for the raw parsed block tree used by the client parse/set helpers.
 */
export const parsedBlockSchema: z.ZodType<WordPressParsedBlock> = z.lazy(() =>
  z.object({
    attrs: recordSchema.nullable(),
    blockName: z.string().nullable(),
    innerBlocks: z.array(parsedBlockSchema),
    innerContent: z.array(z.union([z.string(), z.null()])),
    innerHTML: z.string(),
  }),
);

/**
 * Schema for WordPress users/authors.
 */
export const authorSchema = z
  .object({
    _links: z.any(),
    avatar_urls: z.record(z.string(), z.string()),
    description: z.string().optional().default(""),
    id: z.number(),
    link: z.string(),
    meta: recordOrArraySchema.optional().default([]),
    name: z.string(),
    slug: z.string(),
    url: z.string().optional().default(""),
  })
  .passthrough();

/**
 * Schema for WordPress comments.
 */
export const commentSchema = z
  .object({
    _links: z.any(),
    author: z.number(),
    author_name: z.string(),
    author_url: z.string().optional(),
    content: renderedTextSchema,
    date: z.string(),
    date_gmt: z.string(),
    id: z.number(),
    link: z.string(),
    meta: recordOrArraySchema.optional(),
    parent: z.number(),
    post: z.number(),
    status: z.string(),
    type: z.string(),
  })
  .passthrough();

/**
 * Schema for writable scalar fields shared by create and update post payloads.
 */
export const updatePostFieldsSchema = z
  .object({
    author: z.number().int().optional(),
    categories: z.array(z.number().int()).optional(),
    comment_status: z.string().optional(),
    date: z.string().optional(),
    date_gmt: z.string().optional(),
    featured_media: z.number().int().optional(),
    format: z.string().optional(),
    menu_order: z.number().int().optional(),
    meta: z.record(z.string(), z.any()).optional(),
    parent: z.number().int().optional(),
    password: z.string().optional(),
    ping_status: z.string().optional(),
    slug: z.string().optional(),
    status: z
      .enum(["publish", "draft", "pending", "private", "future"])
      .optional(),
    sticky: z.boolean().optional(),
    tags: z.array(z.number().int()).optional(),
    template: z.string().optional(),
  })
  .passthrough();

/**
 * Shared base schema for post create and update action inputs.
 */
export const postWriteBaseSchema = updatePostFieldsSchema.extend({
  content: z.string().optional(),
  excerpt: z.string().optional(),
  title: z.string().optional(),
});

/**
 * Schema for successful JWT token responses from the WP JWT auth plugin.
 *
 * The optional user identity fields may be included by the plugin depending on
 * its configuration and installed extensions.
 */
export const jwtAuthTokenResponseSchema = z
  .object({
    token: z.string().trim().min(1),
    user_display_name: z.string().trim().min(1).optional(),
    user_email: z.string().trim().min(1).optional(),
    user_nicename: z.string().trim().min(1).optional(),
  })
  .passthrough();

/**
 * Schema for JWT auth plugin error responses.
 *
 * The plugin may omit `code`, `statusCode`, or `data.status` depending on the
 * failure mode and any upstream error normalization.
 */
export const jwtAuthErrorResponseSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    data: z
      .object({
        status: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
    message: z.string().trim().min(1),
    statusCode: z.number().int().optional(),
  })
  .passthrough();

/**
 * Schema for JWT token validation responses from `/jwt-auth/v1/token/validate`.
 *
 * When present, `data.status` contains the HTTP-style status code and may also
 * include additional plugin metadata preserved via passthrough.
 */
export const jwtAuthValidationResponseSchema = z
  .object({
    code: z.string().trim().min(1),
    data: z
      .object({
        status: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Schema for WordPress REST API error responses.
 */
export const wordPressErrorSchema = z.object({
  code: z.string(),
  data: z
    .object({
      status: z.number(),
    })
    .optional(),
  message: z.string(),
});

/**
 * Schema for WordPress site settings.
 */
export const settingsSchema = z.object({
  date_format: z.string(),
  default_category: z.number(),
  default_comment_status: z.string(),
  default_ping_status: z.string(),
  default_post_format: z.string(),
  description: z.string(),
  email: z.string().email().optional(),
  language: z.string(),
  page_for_posts: z.number(),
  page_on_front: z.number(),
  posts_per_page: z.number(),
  show_on_front: z.string(),
  site_icon: z.number().nullable().optional(),
  site_logo: z.number().nullable().optional(),
  start_of_week: z.number(),
  time_format: z.string(),
  timezone: z.string(),
  title: z.string(),
  url: z.string().url(),
  use_smilies: z.boolean(),
});

export type WordPressBase = z.infer<typeof baseWordPressSchema>;
export type WordPressPostLike = z.infer<typeof postLikeWordPressSchema>;
export type WordPressContent = z.infer<typeof contentWordPressSchema>;

/**
 * Core content-bearing post type used as the base for posts, pages, and
 * content-aware post-like workflows.
 */
export type WordPressPostBase = WordPressContent;

/**
 * Generic custom post type shape that defaults to the flexible post-like schema.
 */
export type WordPressCustomPost<
  TExtra extends Record<string, unknown> = Record<string, never>,
> = WordPressPostLike & TExtra;

export type WordPressPost = z.infer<typeof postSchema>;
export type WordPressPage = z.infer<typeof pageSchema>;
export type WordPressMedia = z.infer<typeof mediaSchema>;
export type WordPressCategory = z.infer<typeof categorySchema>;
export type WordPressEmbeddedMedia = z.infer<typeof embeddedMediaSchema>;
export type WordPressAbilityAnnotations = z.infer<
  typeof abilityAnnotationsSchema
>;
export type WordPressAbility = z.infer<typeof abilitySchema>;
export type WordPressAbilityCategory = z.infer<typeof abilityCategorySchema>;
export type WordPressBlockType = z.infer<typeof blockTypeSchema>;
export type WordPressAuthor = z.infer<typeof authorSchema>;
export type WordPressComment = z.infer<typeof commentSchema>;
export type WordPressPostWriteFields = z.infer<typeof updatePostFieldsSchema>;
export type WordPressPostWriteBase = z.infer<typeof postWriteBaseSchema>;
export type WordPressError = z.infer<typeof wordPressErrorSchema>;
export type WordPressSettings = z.infer<typeof settingsSchema>;

/**
 * WordPress tag type aliases category response shape.
 */
export type WordPressTag = WordPressCategory;

/**
 * Schema for a single WordPress cross-resource search result from `/wp/v2/search`.
 */
export const searchResultSchema = z
  .object({
    id: z.number(),
    subtype: z.string(),
    title: z.string(),
    type: z.string(),
    url: z.string(),
  })
  .passthrough();

export type WordPressSearchResult = z.infer<typeof searchResultSchema>;
