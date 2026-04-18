import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared schema fragments reused across resource tool input definitions.
// ---------------------------------------------------------------------------

/** Pagination fields shared by all collection tool inputs. */
export const paginationFields = {
  page: z.number().int().min(1).optional().describe("Page number (1-indexed)"),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Results per page (max 100)"),
};

/**
 * Search field for collection tool inputs.
 *
 * WordPress searches post title and content by default. Add
 * `searchColumns` to narrow which fields are searched, and use
 * `orderby: "relevance"` to rank results by match quality.
 */
export const searchField = {
  search: z
    .string()
    .optional()
    .describe(
      "Limit results to those matching a string. Searches title and content by default.",
    ),
};

/** Field-selection fields supporting both ergonomic and raw WordPress syntax. */
export const fieldSelectionFields = {
  _fields: z
    .array(z.string())
    .optional()
    .describe("WordPress _fields parameter — alias for fields"),
  fields: z
    .array(z.string())
    .optional()
    .describe('Response fields to include (e.g. ["id", "title", "slug"])'),
};

/** Sort fields shared by most collection tool inputs. */
function sortFields<T extends readonly [string, ...string[]]>(options: T) {
  return {
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    orderby: z.enum(options).optional().describe("Field to sort by"),
  };
}

// ---------------------------------------------------------------------------
// Post collection input
// ---------------------------------------------------------------------------

export const postsCollectionInputSchema = z
  .object({
    ...searchField,
    searchColumns: z
      .array(z.enum(["post_title", "post_content", "post_excerpt"]))
      .optional()
      .describe(
        "Which columns to search when search is set. Defaults to title + content. Requires WordPress 6.1+.",
      ),
    ...paginationFields,
    ...sortFields([
      "date",
      "id",
      "title",
      "slug",
      "modified",
      "relevance",
      "author",
      "include",
    ]),
    ...fieldSelectionFields,
    author: z.number().int().optional().describe("Filter by author ID"),
    categories: z
      .array(z.number().int())
      .optional()
      .describe("Filter by category IDs"),
    exclude: z
      .array(z.number().int())
      .optional()
      .describe("Exclude specific post IDs from results"),
    include: z
      .array(z.number().int())
      .optional()
      .describe(
        "Fetch specific posts by ID. Use perPage: 100 to retrieve all in one request.",
      ),
    slug: z
      .array(z.string())
      .optional()
      .describe("Fetch specific posts by slug. Accepts multiple slugs."),
    status: z
      .enum(["publish", "draft", "pending", "private", "future", "trash"])
      .optional()
      .describe("Filter by post status"),
    sticky: z.boolean().optional().describe("Filter sticky posts"),
    tags: z.array(z.number().int()).optional().describe("Filter by tag IDs"),
  })
  .describe(
    "Search and filter WordPress posts. " +
      'Use slug: ["my-post"] or include: [42] to fetch one specific post. ' +
      "Use perPage: 100 to fetch up to 100 posts in one request (WordPress maximum). " +
      "Use search + orderby: relevance to rank by match quality.",
  );

export type PostsCollectionInput = z.infer<typeof postsCollectionInputSchema>;

// ---------------------------------------------------------------------------
// Page collection input
// ---------------------------------------------------------------------------

export const pagesCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...sortFields([
      "date",
      "id",
      "title",
      "slug",
      "modified",
      "relevance",
      "author",
      "include",
      "menu_order",
    ]),
    ...fieldSelectionFields,
    author: z.number().int().optional().describe("Filter by author ID"),
    exclude: z
      .array(z.number().int())
      .optional()
      .describe("Exclude specific page IDs from results"),
    include: z
      .array(z.number().int())
      .optional()
      .describe("Fetch specific pages by ID."),
    parent: z.number().int().optional().describe("Filter by parent page ID"),
    slug: z
      .array(z.string())
      .optional()
      .describe("Fetch specific pages by slug."),
    status: z
      .enum(["publish", "draft", "pending", "private", "future", "trash"])
      .optional()
      .describe("Filter by page status"),
  })
  .describe(
    "Search and filter WordPress pages. " +
      'Use slug: ["about"] or include: [42] to fetch one specific page. ' +
      "Use perPage: 100 to fetch up to 100 pages in one request. " +
      "Use search + orderby: relevance to rank by match quality.",
  );

export type PagesCollectionInput = z.infer<typeof pagesCollectionInputSchema>;

// ---------------------------------------------------------------------------
// Media collection input
// ---------------------------------------------------------------------------

export const mediaCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...sortFields([
      "date",
      "id",
      "title",
      "slug",
      "modified",
      "relevance",
      "author",
      "include",
    ]),
    ...fieldSelectionFields,
    author: z.number().int().optional().describe("Filter by author ID"),
    exclude: z
      .array(z.number().int())
      .optional()
      .describe("Exclude specific media IDs from results"),
    include: z
      .array(z.number().int())
      .optional()
      .describe("Fetch specific media items by ID."),
    mediaType: z
      .enum(["image", "video", "audio", "application"])
      .optional()
      .describe("Filter by media type"),
    mimeType: z
      .string()
      .optional()
      .describe('Filter by MIME type (e.g. "image/jpeg")'),
    slug: z
      .array(z.string())
      .optional()
      .describe("Fetch specific media items by slug."),
  })
  .describe(
    "Search and filter WordPress media items. " +
      'Use include: [42] or slug: ["my-image"] to fetch one specific item.',
  );

export type MediaCollectionInput = z.infer<typeof mediaCollectionInputSchema>;

// ---------------------------------------------------------------------------
// Category collection input
// ---------------------------------------------------------------------------

export const categoriesCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...sortFields(["id", "name", "slug", "count", "term_group", "include"]),
    ...fieldSelectionFields,
    exclude: z
      .array(z.number().int())
      .optional()
      .describe("Exclude specific category IDs from results"),
    hideEmpty: z.boolean().optional().describe("Hide categories with no posts"),
    include: z
      .array(z.number().int())
      .optional()
      .describe("Fetch specific categories by ID."),
    parent: z
      .number()
      .int()
      .optional()
      .describe("Filter by parent category ID"),
  })
  .describe(
    "Search and filter WordPress categories. " +
      "Use include: [3] to fetch one specific category by ID. " +
      "Use perPage: 100 to fetch all categories in one request.",
  );

export type CategoriesCollectionInput = z.infer<
  typeof categoriesCollectionInputSchema
>;

// ---------------------------------------------------------------------------
// Tag collection input
// ---------------------------------------------------------------------------

export const tagsCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...sortFields(["id", "name", "slug", "count", "term_group", "include"]),
    ...fieldSelectionFields,
    exclude: z
      .array(z.number().int())
      .optional()
      .describe("Exclude specific tag IDs from results"),
    hideEmpty: z.boolean().optional().describe("Hide tags with no posts"),
    include: z
      .array(z.number().int())
      .optional()
      .describe("Fetch specific tags by ID."),
  })
  .describe(
    "Search and filter WordPress tags. " +
      "Use include: [5] to fetch one specific tag by ID. " +
      "Use perPage: 100 to fetch all tags in one request.",
  );

export type TagsCollectionInput = z.infer<typeof tagsCollectionInputSchema>;

// ---------------------------------------------------------------------------
// User collection input
// ---------------------------------------------------------------------------

export const usersCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...sortFields([
      "id",
      "name",
      "slug",
      "email",
      "url",
      "registered_date",
      "include",
    ]),
    ...fieldSelectionFields,
    exclude: z
      .array(z.number().int())
      .optional()
      .describe("Exclude specific user IDs from results"),
    include: z
      .array(z.number().int())
      .optional()
      .describe("Fetch specific users by ID."),
    roles: z.array(z.string()).optional().describe("Filter by user roles"),
  })
  .describe(
    "Search and filter WordPress users. " +
      "Use include: [1] to fetch one specific user by ID.",
  );

export type UsersCollectionInput = z.infer<typeof usersCollectionInputSchema>;

// ---------------------------------------------------------------------------
// Comment collection input
// ---------------------------------------------------------------------------

export const commentsCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...sortFields([
      "date",
      "date_gmt",
      "id",
      "include",
      "post",
      "parent",
      "type",
    ]),
    ...fieldSelectionFields,
    author: z.number().int().optional().describe("Filter by author ID"),
    post: z.number().int().optional().describe("Filter by post ID"),
    status: z
      .enum(["hold", "approve", "spam", "trash"])
      .optional()
      .describe("Filter by comment status"),
  })
  .describe("Search and filter WordPress comments");

export type CommentsCollectionInput = z.infer<
  typeof commentsCollectionInputSchema
>;

// ---------------------------------------------------------------------------
// Generic content collection input (for custom post types)
// ---------------------------------------------------------------------------

export const contentCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...fieldSelectionFields,
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    orderby: z.string().optional().describe("Field to sort by"),
    status: z.string().optional().describe("Filter by status"),
  })
  .describe("Search and filter WordPress content");

export type ContentCollectionInput = z.infer<
  typeof contentCollectionInputSchema
>;

// ---------------------------------------------------------------------------
// Generic term collection input (for custom taxonomies)
// ---------------------------------------------------------------------------

export const termCollectionInputSchema = z
  .object({
    ...searchField,
    ...paginationFields,
    ...fieldSelectionFields,
    hideEmpty: z.boolean().optional().describe("Hide terms with no posts"),
    order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    orderby: z.string().optional().describe("Field to sort by"),
  })
  .describe("Search and filter WordPress terms");

export type TermCollectionInput = z.infer<typeof termCollectionInputSchema>;

// ---------------------------------------------------------------------------
// Single-item getter inputs
// ---------------------------------------------------------------------------

/**
 * Unified lookup for post-like content by ID or slug, with optional
 * content and block expansion.
 */
export const contentGetInputSchema = z
  .object({
    id: z
      .number()
      .int()
      .optional()
      .describe("Resource ID (provide id or slug)"),
    slug: z.string().optional().describe("Resource slug (provide id or slug)"),
    ...fieldSelectionFields,
    includeBlocks: z
      .boolean()
      .optional()
      .describe("Include parsed Gutenberg blocks"),
    includeContent: z
      .boolean()
      .optional()
      .describe("Include raw and rendered content"),
  })
  .describe("Get one WordPress content item by ID or slug");

export type ContentGetInput = z.infer<typeof contentGetInputSchema>;

/**
 * Unified lookup for simple resources by ID or slug.
 */
export const simpleGetInputSchema = z
  .object({
    id: z
      .number()
      .int()
      .optional()
      .describe("Resource ID (provide id or slug)"),
    slug: z.string().optional().describe("Resource slug (provide id or slug)"),
    ...fieldSelectionFields,
  })
  .describe("Get one resource by ID or slug");

export type SimpleGetInput = z.infer<typeof simpleGetInputSchema>;

/**
 * Getter input for resources that only support numeric IDs.
 */
export const idOnlyGetInputSchema = z
  .object({
    id: z.number().int().describe("Resource ID"),
    ...fieldSelectionFields,
  })
  .describe("Get one resource by ID");

export type IdOnlyGetInput = z.infer<typeof idOnlyGetInputSchema>;

// ---------------------------------------------------------------------------
// Mutation inputs
// ---------------------------------------------------------------------------

/** Post/page create input with the write payload wrapped in `input`. */
export const postCreateInputSchema = z
  .object({
    input: z
      .object({
        author: z.number().int().optional().describe("Author user ID"),
        categories: z
          .array(z.number().int())
          .optional()
          .describe("Category IDs"),
        content: z.string().optional().describe("Post content (HTML)"),
        excerpt: z.string().optional().describe("Post excerpt"),
        featured_media: z
          .number()
          .int()
          .optional()
          .describe("Featured image ID"),
        meta: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Custom meta fields"),
        slug: z.string().optional().describe("Post slug"),
        status: z
          .enum(["publish", "draft", "pending", "private", "future"])
          .optional()
          .describe("Post status"),
        tags: z.array(z.number().int()).optional().describe("Tag IDs"),
        title: z.string().optional().describe("Post title"),
      })
      .passthrough()
      .describe("Post fields to set"),
  })
  .describe("Create a new WordPress post");

export type PostCreateInput = z.infer<typeof postCreateInputSchema>;

/** Post/page update input with ID and write payload. */
export const postUpdateInputSchema = z
  .object({
    id: z.number().int().describe("Post ID to update"),
    input: z
      .object({
        author: z.number().int().optional().describe("Author user ID"),
        categories: z
          .array(z.number().int())
          .optional()
          .describe("Category IDs"),
        content: z.string().optional().describe("Post content (HTML)"),
        excerpt: z.string().optional().describe("Post excerpt"),
        featured_media: z
          .number()
          .int()
          .optional()
          .describe("Featured image ID"),
        meta: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Custom meta fields"),
        slug: z.string().optional().describe("Post slug"),
        status: z
          .enum(["publish", "draft", "pending", "private", "future"])
          .optional()
          .describe("Post status"),
        tags: z.array(z.number().int()).optional().describe("Tag IDs"),
        title: z.string().optional().describe("Post title"),
      })
      .passthrough()
      .describe("Post fields to update"),
  })
  .describe("Update an existing WordPress post");

export type PostUpdateInput = z.infer<typeof postUpdateInputSchema>;

/** Term (category/tag) create input. */
export const termCreateInputSchema = z
  .object({
    input: z
      .object({
        description: z.string().optional().describe("Term description"),
        meta: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Custom meta fields"),
        name: z.string().describe("Term name"),
        parent: z.number().int().optional().describe("Parent term ID"),
        slug: z.string().optional().describe("Term slug"),
      })
      .passthrough()
      .describe("Term fields to set"),
  })
  .describe("Create a new WordPress term");

export type TermCreateInput = z.infer<typeof termCreateInputSchema>;

/** Term update input. */
export const termUpdateInputSchema = z
  .object({
    id: z.number().int().describe("Term ID to update"),
    input: z
      .object({
        description: z.string().optional().describe("Term description"),
        meta: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Custom meta fields"),
        name: z.string().optional().describe("Term name"),
        parent: z.number().int().optional().describe("Parent term ID"),
        slug: z.string().optional().describe("Term slug"),
      })
      .passthrough()
      .describe("Term fields to update"),
  })
  .describe("Update an existing WordPress term");

export type TermUpdateInput = z.infer<typeof termUpdateInputSchema>;

/** User create input. */
export const userCreateInputSchema = z
  .object({
    input: z
      .object({
        email: z.string().describe("Email address"),
        first_name: z.string().optional().describe("First name"),
        last_name: z.string().optional().describe("Last name"),
        name: z.string().optional().describe("Display name"),
        password: z.string().describe("User password"),
        roles: z.array(z.string()).optional().describe("User roles"),
        username: z.string().describe("Login username"),
      })
      .passthrough()
      .describe("User fields to set"),
  })
  .describe("Create a new WordPress user");

export type UserCreateInput = z.infer<typeof userCreateInputSchema>;

/** User update input. */
export const userUpdateInputSchema = z
  .object({
    id: z.number().int().describe("User ID to update"),
    input: z
      .object({
        email: z.string().optional().describe("Email address"),
        first_name: z.string().optional().describe("First name"),
        last_name: z.string().optional().describe("Last name"),
        name: z.string().optional().describe("Display name"),
        password: z.string().optional().describe("New password"),
        roles: z.array(z.string()).optional().describe("User roles"),
      })
      .passthrough()
      .describe("User fields to update"),
  })
  .describe("Update an existing WordPress user");

export type UserUpdateInput = z.infer<typeof userUpdateInputSchema>;

/** Comment create input. */
export const commentCreateInputSchema = z
  .object({
    input: z
      .object({
        author: z.number().int().optional().describe("Author user ID"),
        author_email: z.string().optional().describe("Author email"),
        author_name: z.string().optional().describe("Author display name"),
        content: z.string().describe("Comment content (HTML)"),
        parent: z
          .number()
          .int()
          .optional()
          .describe("Parent comment ID for replies"),
        post: z.number().int().describe("Post ID to comment on"),
        status: z.string().optional().describe("Comment status"),
      })
      .passthrough()
      .describe("Comment fields to set"),
  })
  .describe("Create a new WordPress comment");

export type CommentCreateInput = z.infer<typeof commentCreateInputSchema>;

/** Comment update input. */
export const commentUpdateInputSchema = z
  .object({
    id: z.number().int().describe("Comment ID to update"),
    input: z
      .object({
        content: z.string().optional().describe("Comment content (HTML)"),
        status: z.string().optional().describe("Comment status"),
      })
      .passthrough()
      .describe("Comment fields to update"),
  })
  .describe("Update an existing WordPress comment");

export type CommentUpdateInput = z.infer<typeof commentUpdateInputSchema>;

/** Generic content create input (for custom post types). */
export const contentCreateInputSchema = z
  .object({
    input: z.record(z.string(), z.unknown()).describe("Resource fields to set"),
  })
  .describe("Create a new WordPress content item");

export type ContentCreateInput = z.infer<typeof contentCreateInputSchema>;

/** Generic content update input. */
export const contentUpdateInputSchema = z
  .object({
    id: z.number().int().describe("Resource ID to update"),
    input: z
      .record(z.string(), z.unknown())
      .describe("Resource fields to update"),
  })
  .describe("Update an existing WordPress content item");

export type ContentUpdateInput = z.infer<typeof contentUpdateInputSchema>;

/** Settings update input. */
export const settingsUpdateInputSchema = z
  .object({
    input: z
      .object({
        date_format: z.string().optional().describe("Date format"),
        description: z.string().optional().describe("Site tagline"),
        posts_per_page: z.number().int().optional().describe("Posts per page"),
        start_of_week: z
          .number()
          .int()
          .optional()
          .describe("Start of week (0=Sunday)"),
        time_format: z.string().optional().describe("Time format"),
        timezone: z.string().optional().describe("Timezone string"),
        title: z.string().optional().describe("Site title"),
      })
      .passthrough()
      .describe("Settings fields to update"),
  })
  .describe("Update WordPress site settings");

export type SettingsUpdateInput = z.infer<typeof settingsUpdateInputSchema>;

// ---------------------------------------------------------------------------
// Delete input
// ---------------------------------------------------------------------------

export const deleteInputSchema = z
  .object({
    force: z
      .boolean()
      .optional()
      .describe("Bypass trash and permanently delete"),
    id: z.number().int().describe("Resource ID to delete"),
  })
  .describe("Delete a WordPress resource");

export type DeleteInput = z.infer<typeof deleteInputSchema>;

/** User delete input with reassignment. */
export const userDeleteInputSchema = z
  .object({
    force: z
      .boolean()
      .optional()
      .describe("Bypass trash and permanently delete"),
    id: z.number().int().describe("User ID to delete"),
    reassign: z
      .number()
      .int()
      .optional()
      .describe("Reassign content to this user ID"),
  })
  .describe("Delete a WordPress user");

export type UserDeleteInput = z.infer<typeof userDeleteInputSchema>;

// ---------------------------------------------------------------------------
// Ability inputs
// ---------------------------------------------------------------------------

export const abilityGetInputSchema = z
  .object({
    input: z
      .unknown()
      .optional()
      .describe("Optional primitive input value for GET execution"),
    name: z.string().describe("Ability name in namespace/ability format"),
  })
  .describe("Execute a read-only WordPress ability");

export type AbilityGetInput = z.infer<typeof abilityGetInputSchema>;

export const abilityRunInputSchema = z
  .object({
    input: z
      .unknown()
      .optional()
      .describe("Optional input value for POST execution"),
    name: z.string().describe("Ability name in namespace/ability format"),
  })
  .describe("Execute a WordPress ability via POST");

export type AbilityRunInput = z.infer<typeof abilityRunInputSchema>;

export const abilityDeleteInputSchema = z
  .object({
    input: z
      .unknown()
      .optional()
      .describe("Optional primitive input value for DELETE execution"),
    name: z.string().describe("Ability name in namespace/ability format"),
  })
  .describe("Execute a destructive WordPress ability");

export type AbilityDeleteInput = z.infer<typeof abilityDeleteInputSchema>;
