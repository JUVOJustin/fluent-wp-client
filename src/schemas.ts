import { z } from 'zod';

/**
 * Base schema shared by all WordPress content response types.
 */
export const baseWordPressSchema = z.object({
  id: z.number(),
  date: z.string(),
  date_gmt: z.string(),
  guid: z.object({
    rendered: z.string(),
  }),
  modified: z.string(),
  modified_gmt: z.string(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
  link: z.string().url(),
  title: z.object({
    rendered: z.string(),
  }),
  author: z.number(),
  meta: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _links: z.any(),
}).passthrough();

/**
 * Schema for content types (posts and pages).
 */
export const contentWordPressSchema = baseWordPressSchema.extend({
  content: z.object({
    rendered: z.string(),
    raw: z.string().optional(),
    protected: z.boolean(),
  }),
  excerpt: z.object({
    rendered: z.string(),
    raw: z.string().optional(),
    protected: z.boolean(),
  }),
  featured_media: z.number().optional(),
  comment_status: z.string(),
  ping_status: z.string(),
  template: z.string(),
  acf: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _embedded: z.any().optional(),
});

/**
 * Default schema for WordPress posts.
 */
export const postSchema = contentWordPressSchema.extend({
  sticky: z.boolean(),
  format: z.string(),
  categories: z.array(z.number()).default([]),
  tags: z.array(z.number()).default([]),
});

/**
 * Default schema for WordPress pages.
 */
export const pageSchema = contentWordPressSchema.extend({
  parent: z.number().default(0),
  menu_order: z.number().default(0),
  class_list: z.array(z.string()).default([]),
});

/**
 * Schema for WordPress media items.
 */
export const mediaSchema = baseWordPressSchema.extend({
  comment_status: z.string(),
  ping_status: z.string(),
  alt_text: z.string(),
  caption: z.object({
    rendered: z.string(),
  }),
  description: z.object({
    rendered: z.string(),
  }),
  media_type: z.string(),
  mime_type: z.string(),
  media_details: z.object({
    width: z.number(),
    height: z.number(),
    file: z.string(),
    filesize: z.number().optional(),
    sizes: z.record(z.object({
      file: z.string(),
      width: z.number(),
      height: z.number(),
      filesize: z.number().optional(),
      mime_type: z.string(),
      source_url: z.string(),
    })),
    image_meta: z.any(),
  }),
  source_url: z.string(),
});

/**
 * Schema for WordPress categories and taxonomies.
 */
export const categorySchema = z.object({
  id: z.number(),
  count: z.number(),
  description: z.string(),
  link: z.string().url(),
  name: z.string(),
  slug: z.string(),
  taxonomy: z.string(),
  parent: z.number().default(0),
  meta: z.array(z.any()).or(z.record(z.any())),
  acf: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _embedded: z.any().optional(),
  _links: z.any(),
}).passthrough();

/**
 * Schema for WordPress embedded media in `_embedded` responses.
 */
export const embeddedMediaSchema = z.object({
  id: z.number(),
  date: z.string(),
  slug: z.string(),
  type: z.string(),
  link: z.string(),
  title: z.object({
    rendered: z.string(),
  }),
  author: z.number(),
  featured_media: z.number(),
  caption: z.object({
    rendered: z.string(),
  }),
  alt_text: z.string(),
  media_type: z.string(),
  mime_type: z.string(),
  media_details: z.object({
    width: z.number(),
    height: z.number(),
    file: z.string(),
    filesize: z.number().optional(),
    sizes: z.record(z.object({
      file: z.string(),
      width: z.number(),
      height: z.number(),
      filesize: z.number().optional(),
      mime_type: z.string(),
      source_url: z.string(),
    })),
    image_meta: z.any().optional(),
  }),
  source_url: z.string(),
  acf: z.any().optional(),
  _links: z.any().optional(),
}).passthrough();

/**
 * Schema for ability execution annotations exposed by WordPress.
 */
export const abilityAnnotationsSchema = z.object({
  instructions: z.string().optional(),
  readonly: z.boolean().optional(),
  destructive: z.boolean().optional(),
  idempotent: z.boolean().nullable().optional(),
}).passthrough();

/**
 * Schema for one WordPress ability definition.
 */
export const abilitySchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  input_schema: z.any().optional(),
  output_schema: z.any().optional(),
  meta: z.object({
    annotations: abilityAnnotationsSchema.optional(),
  }).passthrough().optional(),
}).passthrough();

/**
 * Schema for one WordPress ability category.
 */
export const abilityCategorySchema = z.object({
  slug: z.string(),
  label: z.string(),
  description: z.string().optional(),
  meta: z.any().optional(),
  _links: z.any().optional(),
}).passthrough();

/**
 * Schema for WordPress users/authors.
 */
export const authorSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().optional().default(''),
  description: z.string().optional().default(''),
  link: z.string(),
  slug: z.string(),
  avatar_urls: z.record(z.string()),
  meta: z.array(z.any()).or(z.record(z.any())).optional().default([]),
  _links: z.any(),
}).passthrough();

/**
 * Schema for WordPress comments.
 */
export const commentSchema = z.object({
  id: z.number(),
  post: z.number(),
  parent: z.number(),
  author: z.number(),
  author_name: z.string(),
  author_url: z.string().optional(),
  date: z.string(),
  date_gmt: z.string(),
  content: z.object({
    rendered: z.string(),
  }),
  link: z.string(),
  status: z.string(),
  type: z.string(),
  meta: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  _links: z.any(),
}).passthrough();

/**
 * Schema for writable scalar fields shared by create and update post payloads.
 */
export const updatePostFieldsSchema = z.object({
  date: z.string().optional(),
  date_gmt: z.string().optional(),
  slug: z.string().optional(),
  status: z.enum(['publish', 'draft', 'pending', 'private', 'future']).optional(),
  password: z.string().optional(),
  author: z.number().int().optional(),
  featured_media: z.number().int().optional(),
  comment_status: z.string().optional(),
  ping_status: z.string().optional(),
  format: z.string().optional(),
  meta: z.record(z.any()).optional(),
  sticky: z.boolean().optional(),
  template: z.string().optional(),
  categories: z.array(z.number().int()).optional(),
  tags: z.array(z.number().int()).optional(),
  parent: z.number().int().optional(),
  menu_order: z.number().int().optional(),
}).passthrough();

/**
 * Shared base schema for post create and update action inputs.
 */
export const postWriteBaseSchema = updatePostFieldsSchema.extend({
  title: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
});

/**
 * Schema for WordPress REST API error responses.
 */
export const wordPressErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z.object({
    status: z.number(),
  }).optional(),
});

/**
 * Schema for WordPress site settings.
 */
export const settingsSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().url(),
  email: z.string().email().optional(),
  timezone: z.string(),
  date_format: z.string(),
  time_format: z.string(),
  start_of_week: z.number(),
  language: z.string(),
  use_smilies: z.boolean(),
  default_category: z.number(),
  default_post_format: z.string(),
  posts_per_page: z.number(),
  show_on_front: z.string(),
  page_on_front: z.number(),
  page_for_posts: z.number(),
  default_ping_status: z.string(),
  default_comment_status: z.string(),
  site_logo: z.number().nullable().optional(),
  site_icon: z.number().nullable().optional(),
});

export type WordPressBase = z.infer<typeof baseWordPressSchema>;
export type WordPressContent = z.infer<typeof contentWordPressSchema>;
export type WordPressPost = z.infer<typeof postSchema>;
export type WordPressPage = z.infer<typeof pageSchema>;
export type WordPressMedia = z.infer<typeof mediaSchema>;
export type WordPressCategory = z.infer<typeof categorySchema>;
export type WordPressEmbeddedMedia = z.infer<typeof embeddedMediaSchema>;
export type WordPressAbilityAnnotations = z.infer<typeof abilityAnnotationsSchema>;
export type WordPressAbility = z.infer<typeof abilitySchema>;
export type WordPressAbilityCategory = z.infer<typeof abilityCategorySchema>;
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
