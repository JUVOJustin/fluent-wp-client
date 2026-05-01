import { tool } from "ai";
import { type ZodType, z } from "zod";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type {
  WordPressDiscoveryCatalog,
  WordPressResourceDescription,
} from "../types/discovery.js";
import type {
  CommentsFilter,
  MediaFilter,
  UsersFilter,
} from "../types/filters.js";
import type { QueryParams } from "../types/resources.js";
import { zodSchemasFromDescription } from "../zod-helpers.js";
import {
  asToolArgs,
  normalizeFieldSelection,
  prepareCollectionArgs,
  withToolErrorHandling,
} from "./factories.js";
import { createFieldSelectionShape } from "./field-schemas.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import {
  commentsCollectionInputSchema,
  commentUpdateInputSchema,
  deleteInputSchema,
  idOnlyGetInputSchema,
  mediaCollectionInputSchema,
  simpleGetInputSchema,
  userDeleteInputSchema,
  usersCollectionInputSchema,
  userUpdateInputSchema,
} from "./schemas.js";
import type {
  ResourceCollectionToolOptions,
  ResourceDeleteToolOptions,
  ResourceGetToolOptions,
  ResourceSaveToolOptions,
  ToolFactoryOptions,
} from "./types.js";

type SupportedResourceType = "media" | "comments" | "users";

const SUPPORTED_RESOURCE_TYPES = ["media", "comments", "users"] as const;

function _createResourceTypeSchema(catalog?: WordPressDiscoveryCatalog) {
  const values = SUPPORTED_RESOURCE_TYPES.filter(
    (value) => !catalog?.resources || value in catalog.resources,
  );
  return z.enum(
    (values.length > 0 ? values : SUPPORTED_RESOURCE_TYPES) as [
      SupportedResourceType,
      ...SupportedResourceType[],
    ],
  );
}

function buildResourceUnion(
  discriminator: "resourceType",
  variants: z.ZodObject<any>[],
): ZodType {
  if (variants.length === 1) return variants[0];
  return z.discriminatedUnion(
    discriminator,
    variants as [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]],
  );
}

function getResourceDescription(
  catalog: WordPressDiscoveryCatalog | undefined,
  resourceType: SupportedResourceType,
): WordPressResourceDescription | undefined {
  return catalog?.resources?.[resourceType];
}

function resolveResourceType(
  merged: Record<string, unknown>,
  options?: { resourceType?: SupportedResourceType },
): SupportedResourceType {
  const resourceType = options?.resourceType ?? merged.resourceType;
  if (
    resourceType === "media" ||
    resourceType === "comments" ||
    resourceType === "users"
  ) {
    return resourceType;
  }

  throw createInvalidRequestError(
    "resourceType must be one of media, comments, or users.",
  );
}

function stripResourceType(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const { resourceType: _resourceType, ...rest } = args;
  return rest;
}

/**
 * Base schemas per supported resource, split by read shape.
 *
 * Comments only accept numeric IDs on single-item reads, while media and
 * users accept either an ID or a slug.
 */
const RESOURCE_READ_SCHEMAS: Record<
  SupportedResourceType,
  {
    collection: z.ZodObject<z.ZodRawShape>;
    get: z.ZodObject<z.ZodRawShape>;
  }
> = {
  comments: {
    collection: commentsCollectionInputSchema,
    get: idOnlyGetInputSchema,
  },
  media: {
    collection: mediaCollectionInputSchema,
    get: simpleGetInputSchema,
  },
  users: {
    collection: usersCollectionInputSchema,
    get: simpleGetInputSchema,
  },
};

/**
 * Builds a catalog-aware read input schema for one resource family.
 *
 * Mirrors `buildCatalogReadSchema` over in `catalog-schemas.ts` but for the
 * fixed `media` / `comments` / `users` set. When no `resourceType` is pinned
 * the model picks one through a discriminated union.
 */
function buildCatalogResourceReadSchema(
  catalog: WordPressDiscoveryCatalog | undefined,
  resourceType: SupportedResourceType | undefined,
  mode: "collection" | "get",
  unionDescription: string,
  variantDescription: (resourceType: SupportedResourceType) => string,
): ZodType {
  if (resourceType) {
    return RESOURCE_READ_SCHEMAS[resourceType][mode]
      .extend(
        createFieldSelectionShape(
          getResourceDescription(catalog, resourceType),
          "read",
        ),
      )
      .describe(variantDescription(resourceType));
  }

  const variants = SUPPORTED_RESOURCE_TYPES.map((variant) =>
    RESOURCE_READ_SCHEMAS[variant][mode].extend({
      resourceType: z.literal(variant),
      ...createFieldSelectionShape(
        getResourceDescription(catalog, variant),
        "read",
      ),
    }),
  );

  return buildResourceUnion("resourceType", variants).describe(
    unionDescription,
  );
}

function createCollectionInputSchema(options?: {
  resourceType?: SupportedResourceType;
  catalog?: WordPressDiscoveryCatalog;
}): ZodType {
  return buildCatalogResourceReadSchema(
    options?.catalog,
    options?.resourceType,
    "collection",
    "Search and filter WordPress media, comments, or users",
    (resourceType) => `Search and filter WordPress ${resourceType}`,
  );
}

function createGetInputSchema(options?: {
  resourceType?: SupportedResourceType;
  catalog?: WordPressDiscoveryCatalog;
}): ZodType {
  return buildCatalogResourceReadSchema(
    options?.catalog,
    options?.resourceType,
    "get",
    "Get one WordPress media item, comment, or user",
    (resourceType) =>
      resourceType === "comments"
        ? "Get one WordPress comment"
        : resourceType === "media"
          ? "Get one WordPress media item"
          : "Get one WordPress user",
  );
}

/**
 * Builds a unified save input schema for one resource type.
 *
 * Mirrors content/term save schemas: the schema validates against the
 * discovered update payload when available (which has no required fields)
 * so the same payload can drive both create and update calls. Presence of
 * `id` at runtime routes the request to the correct client method.
 */
function createResourceSaveVariantSchema(
  resourceType: "comments" | "users",
  description: WordPressResourceDescription | undefined,
): z.ZodObject<z.ZodRawShape> {
  const schemas = description
    ? zodSchemasFromDescription(description)
    : undefined;
  const fallback =
    resourceType === "comments"
      ? commentUpdateInputSchema.shape.input
      : userUpdateInputSchema.shape.input;
  const input = (schemas?.update ?? schemas?.create ?? fallback) as ZodType;

  return z.object({
    id: z
      .number()
      .int()
      .optional()
      .describe("Resource ID to update. Omit to create a new item instead."),
    input: input as never,
  });
}

function createSaveInputSchema(options?: {
  resourceType?: SupportedResourceType;
  catalog?: WordPressDiscoveryCatalog;
}): ZodType {
  if (options?.resourceType === "media") {
    return z
      .object({})
      .describe(
        "Media writes are not exposed by this AI SDK resource tool. Use client.media().upload() for uploads.",
      );
  }

  if (
    options?.resourceType === "comments" ||
    options?.resourceType === "users"
  ) {
    return createResourceSaveVariantSchema(
      options.resourceType,
      getResourceDescription(options.catalog, options.resourceType),
    ).describe(
      options.resourceType === "comments"
        ? "Create or update a WordPress comment"
        : "Create or update a WordPress user",
    );
  }

  return buildResourceUnion("resourceType", [
    createResourceSaveVariantSchema(
      "comments",
      getResourceDescription(options?.catalog, "comments"),
    ).extend({ resourceType: z.literal("comments") }),
    createResourceSaveVariantSchema(
      "users",
      getResourceDescription(options?.catalog, "users"),
    ).extend({ resourceType: z.literal("users") }),
  ]).describe("Create or update a WordPress comment or user");
}

function createDeleteInputSchema(options?: {
  resourceType?: SupportedResourceType;
  catalog?: WordPressDiscoveryCatalog;
}): ZodType {
  if (options?.resourceType === "users") return userDeleteInputSchema;
  if (options?.resourceType === "media" || options?.resourceType === "comments")
    return deleteInputSchema;

  return buildResourceUnion("resourceType", [
    deleteInputSchema.extend({ resourceType: z.literal("media") }),
    deleteInputSchema.extend({ resourceType: z.literal("comments") }),
    userDeleteInputSchema.extend({ resourceType: z.literal("users") }),
  ]).describe("Delete a WordPress media item, comment, or user");
}

async function listResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  filter: Record<string, unknown>,
) {
  if (resourceType === "media")
    return client.media().list(filter as MediaFilter & QueryParams);
  if (resourceType === "comments")
    return client.comments().list(filter as CommentsFilter & QueryParams);
  return client.users().list(filter as UsersFilter & QueryParams);
}

async function getResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  merged: Record<string, unknown>,
) {
  const itemOptions = { fields: merged.fields as string[] | undefined };

  if (resourceType === "comments") {
    return client.comments().item(merged.id as number, itemOptions);
  }

  if (merged.id) {
    return resourceType === "media"
      ? client.media().item(merged.id as number, itemOptions)
      : client.users().item(merged.id as number, itemOptions);
  }

  if (merged.slug) {
    return resourceType === "media"
      ? client.media().item(merged.slug as string, itemOptions)
      : client.users().item(merged.slug as string, itemOptions);
  }

  throw createInvalidRequestError(
    "Either id or slug must be provided. Comments only support numeric IDs.",
  );
}

async function saveResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  id: number | undefined,
  input: Record<string, unknown>,
) {
  if (resourceType === "media") {
    throw createInvalidRequestError(
      "Media writes are not supported by the generic AI SDK resource tool. Use client.media().upload() for uploads.",
    );
  }

  const resource =
    resourceType === "comments" ? client.comments() : client.users();
  return id === undefined ? resource.create(input) : resource.update(id, input);
}

async function deleteResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  merged: Record<string, unknown>,
) {
  if (resourceType === "users") {
    return client.users().delete(merged.id as number, {
      force: merged.force as boolean | undefined,
      reassign: merged.reassign as number | undefined,
    });
  }

  return resourceType === "media"
    ? client.media().delete(merged.id as number, {
        force: merged.force as boolean | undefined,
      })
    : client.comments().delete(merged.id as number, {
        force: merged.force as boolean | undefined,
      });
}

/**
 * AI SDK tool that lists media, comments, or users.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `resourceType` and normalised `filter` after `fixedArgs` have been applied.
 */
export const getResourceCollectionTool = (
  client: WordPressClient,
  options?: ResourceCollectionToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ??
      "Search and filter WordPress media, comments, or users",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const resourceType = resolveResourceType(merged, options);
      const filter = prepareCollectionArgs(
        stripResourceType(merged),
        options as ToolFactoryOptions<Record<string, unknown>>,
      );

      if (options?.fetch) {
        return options.fetch({ filter: filter as QueryParams, resourceType });
      }

      return listResource(client, resourceType, filter);
    }),
    inputSchema: (options?.inputSchema ??
      createCollectionInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that fetches a single media item, comment, or user.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `resourceType`, normalised `id` or `slug`, and any `_fields` selection
 * after `fixedArgs` have been applied.
 */
export const getResourceTool = (
  client: WordPressClient,
  options?: ResourceGetToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ??
      "Get a single WordPress media item, comment, or user",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = normalizeFieldSelection(
        mergeToolArgs(
          asToolArgs(args as Record<string, unknown>),
          options?.fixedArgs,
        ),
      );
      const resourceType = resolveResourceType(merged, options);
      const id = typeof merged.id === "number" ? merged.id : undefined;
      const slug = typeof merged.slug === "string" ? merged.slug : undefined;
      const fields = merged.fields as string[] | undefined;

      if (options?.fetch) {
        return options.fetch({ fields, id, resourceType, slug });
      }

      return getResource(client, resourceType, merged);
    }),
    inputSchema: (options?.inputSchema ??
      createGetInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that creates or updates a WordPress comment or user.
 *
 * Presence of `id` in the model input switches to an update call; omitting
 * `id` routes to a create call. One tool covers both mutation modes so the
 * model only sees a single mutation surface.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `resourceType`, optional `id`, and merged `input` after `fixedInput` has
 * been applied.
 */
export const saveResourceTool = (
  client: WordPressClient,
  options?: ResourceSaveToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ?? "Create or update a WordPress comment or user",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const resourceType = resolveResourceType(merged, options);
      const withInput = mergeMutationInput(
        merged,
        options?.defaultInput,
        options?.fixedInput,
      );
      const id =
        typeof withInput.id === "number" ? (withInput.id as number) : undefined;
      const input = withInput.input as Record<string, unknown>;

      if (options?.fetch) {
        return options.fetch({ id, input, resourceType });
      }

      return saveResource(client, resourceType, id, input);
    }),
    inputSchema: (options?.inputSchema ??
      createSaveInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that deletes a WordPress media item, comment, or user.
 *
 * Provide `fetch` to replace the default client call. Receives the resolved
 * `resourceType`, `id`, and optional `force` / `reassign` flags.
 */
export const deleteResourceTool = (
  client: WordPressClient,
  options?: ResourceDeleteToolOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: options?.catalog ?? client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ?? "Delete a WordPress media item, comment, or user",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      const resourceType = resolveResourceType(merged, options);

      if (options?.fetch) {
        return options.fetch({
          force: merged.force as boolean | undefined,
          id: merged.id as number,
          reassign: merged.reassign as number | undefined,
          resourceType,
        });
      }

      return deleteResource(client, resourceType, merged);
    }),
    inputSchema: (options?.inputSchema ??
      createDeleteInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};
