import { tool } from 'ai';
import { z, type ZodType } from 'zod';
import type { WordPressClient } from '../client.js';
import type { WordPressDiscoveryCatalog, WordPressResourceDescription } from '../types/discovery.js';
import { zodSchemasFromDescription } from '../zod-helpers.js';
import type { CommentsFilter, MediaFilter, UsersFilter } from '../types/filters.js';
import type { QueryParams } from '../types/resources.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { prepareCollectionArgs, asToolArgs, withToolErrorHandling } from './factories.js';
import type { CatalogMutationToolFactoryOptions, CatalogToolFactoryOptions, ToolFactoryOptions } from './types.js';
import {
  commentCreateInputSchema,
  commentUpdateInputSchema,
  commentsCollectionInputSchema,
  deleteInputSchema,
  idOnlyGetInputSchema,
  mediaCollectionInputSchema,
  simpleGetInputSchema,
  userCreateInputSchema,
  userDeleteInputSchema,
  userUpdateInputSchema,
  usersCollectionInputSchema,
} from './schemas.js';

type SupportedResourceType = 'media' | 'comments' | 'users';

const SUPPORTED_RESOURCE_TYPES = ['media', 'comments', 'users'] as const;

function createResourceTypeSchema(catalog?: WordPressDiscoveryCatalog) {
  const values = SUPPORTED_RESOURCE_TYPES.filter((value) => !catalog?.resources || value in catalog.resources);
  return z.enum((values.length > 0 ? values : SUPPORTED_RESOURCE_TYPES) as [SupportedResourceType, ...SupportedResourceType[]]);
}

function buildResourceUnion(
  discriminator: 'resourceType',
  variants: z.ZodObject<any>[],
): ZodType {
  if (variants.length === 1) return variants[0];
  return z.discriminatedUnion(discriminator, variants as [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]]);
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
  if (resourceType === 'media' || resourceType === 'comments' || resourceType === 'users') {
    return resourceType;
  }

  throw new Error('resourceType must be one of media, comments, or users.');
}

function stripResourceType(args: Record<string, unknown>): Record<string, unknown> {
  const { resourceType: _resourceType, ...rest } = args;
  return rest;
}

function createCollectionInputSchema(options?: { resourceType?: SupportedResourceType; catalog?: WordPressDiscoveryCatalog }): ZodType {
  if (options?.resourceType === 'media') return mediaCollectionInputSchema;
  if (options?.resourceType === 'comments') return commentsCollectionInputSchema;
  if (options?.resourceType === 'users') return usersCollectionInputSchema;

  return buildResourceUnion('resourceType', [
    mediaCollectionInputSchema.extend({ resourceType: z.literal('media') }),
    commentsCollectionInputSchema.extend({ resourceType: z.literal('comments') }),
    usersCollectionInputSchema.extend({ resourceType: z.literal('users') }),
  ]).describe('Search and filter WordPress media, comments, or users');
}

function createGetInputSchema(options?: { resourceType?: SupportedResourceType; catalog?: WordPressDiscoveryCatalog }): ZodType {
  if (options?.resourceType === 'comments') return idOnlyGetInputSchema;
  if (options?.resourceType === 'media' || options?.resourceType === 'users') return simpleGetInputSchema;

  return buildResourceUnion('resourceType', [
    simpleGetInputSchema.extend({ resourceType: z.literal('media') }),
    idOnlyGetInputSchema.extend({ resourceType: z.literal('comments') }),
    simpleGetInputSchema.extend({ resourceType: z.literal('users') }),
  ]).describe('Get one WordPress media item, comment, or user');
}

function createMutationSchema(
  resourceType: SupportedResourceType,
  description: WordPressResourceDescription | undefined,
  mode: 'create' | 'update',
): ZodType {
  const schemas = description ? zodSchemasFromDescription(description) : undefined;
  const dynamic = mode === 'create' ? schemas?.create : schemas?.update;

  if (mode === 'create') {
    const fallback = resourceType === 'comments' ? commentCreateInputSchema.shape.input : userCreateInputSchema.shape.input;
    return z.object({ input: (dynamic ?? fallback) as never });
  }

  const fallback = resourceType === 'comments' ? commentUpdateInputSchema.shape.input : userUpdateInputSchema.shape.input;
  return z.object({ id: z.number().int(), input: (dynamic ?? fallback) as never });
}

function createCreateInputSchema(options?: { resourceType?: SupportedResourceType; catalog?: WordPressDiscoveryCatalog }): ZodType {
  if (options?.resourceType === 'media') {
    return z.object({}).describe('Media upload is not supported by the AI SDK resource tool. Use the client upload API directly.');
  }

  if (options?.resourceType === 'comments' || options?.resourceType === 'users') {
    return createMutationSchema(options.resourceType, getResourceDescription(options.catalog, options.resourceType), 'create');
  }

  return buildResourceUnion('resourceType', [
    commentCreateInputSchema.extend({ resourceType: z.literal('comments') }),
    userCreateInputSchema.extend({ resourceType: z.literal('users') }),
  ]).describe('Create a WordPress comment or user');
}

function createUpdateInputSchema(options?: { resourceType?: SupportedResourceType; catalog?: WordPressDiscoveryCatalog }): ZodType {
  if (options?.resourceType === 'media') {
    return z.object({}).describe('Media updates are not exposed by this AI SDK resource tool.');
  }

  if (options?.resourceType === 'comments' || options?.resourceType === 'users') {
    return createMutationSchema(options.resourceType, getResourceDescription(options.catalog, options.resourceType), 'update');
  }

  return buildResourceUnion('resourceType', [
    commentUpdateInputSchema.extend({ resourceType: z.literal('comments') }),
    userUpdateInputSchema.extend({ resourceType: z.literal('users') }),
  ]).describe('Update a WordPress comment or user');
}

function createDeleteInputSchema(options?: { resourceType?: SupportedResourceType; catalog?: WordPressDiscoveryCatalog }): ZodType {
  if (options?.resourceType === 'users') return userDeleteInputSchema;
  if (options?.resourceType === 'media' || options?.resourceType === 'comments') return deleteInputSchema;

  return buildResourceUnion('resourceType', [
    deleteInputSchema.extend({ resourceType: z.literal('media') }),
    deleteInputSchema.extend({ resourceType: z.literal('comments') }),
    userDeleteInputSchema.extend({ resourceType: z.literal('users') }),
  ]).describe('Delete a WordPress media item, comment, or user');
}

async function listResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  filter: Record<string, unknown>,
) {
  if (resourceType === 'media') return client.media().list(filter as MediaFilter & QueryParams);
  if (resourceType === 'comments') return client.comments().list(filter as CommentsFilter & QueryParams);
  return client.users().list(filter as UsersFilter & QueryParams);
}

async function getResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  merged: Record<string, unknown>,
) {
  if (resourceType === 'comments') {
    return client.comments().item(merged.id as number);
  }

  if (merged.id) {
    return resourceType === 'media'
      ? client.media().item(merged.id as number)
      : client.users().item(merged.id as number);
  }

  if (merged.slug) {
    return resourceType === 'media'
      ? client.media().item(merged.slug as string)
      : client.users().item(merged.slug as string);
  }

  throw new Error('Either id or slug must be provided. Comments only support numeric IDs.');
}

async function createResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  input: Record<string, unknown>,
) {
  if (resourceType === 'media') {
    throw new Error('Media upload is not supported by the generic AI SDK resource tool. Use client.media().upload().');
  }

  return resourceType === 'comments'
    ? client.comments().create(input)
    : client.users().create(input);
}

async function updateResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  id: number,
  input: Record<string, unknown>,
) {
  if (resourceType === 'media') {
    throw new Error('Media updates are not supported by the generic AI SDK resource tool.');
  }

  return resourceType === 'comments'
    ? client.comments().update(id, input)
    : client.users().update(id, input);
}

async function deleteResource(
  client: WordPressClient,
  resourceType: SupportedResourceType,
  merged: Record<string, unknown>,
) {
  if (resourceType === 'users') {
    return client.users().delete(merged.id as number, {
      force: merged.force as boolean | undefined,
      reassign: merged.reassign as number | undefined,
    });
  }

  return resourceType === 'media'
    ? client.media().delete(merged.id as number, { force: merged.force as boolean | undefined })
    : client.comments().delete(merged.id as number, { force: merged.force as boolean | undefined });
}

export interface ResourceToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogToolFactoryOptions<TArgs> {
  resourceType?: SupportedResourceType;
}

export interface ResourceMutationToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogMutationToolFactoryOptions<TArgs> {
  resourceType?: SupportedResourceType;
}

export const getResourceCollectionTool = (
  client: WordPressClient,
  options?: ResourceToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Search and filter WordPress media, comments, or users',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createCollectionInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const resourceType = resolveResourceType(merged, options);
    const filter = prepareCollectionArgs(stripResourceType(merged), options as ToolFactoryOptions<Record<string, unknown>>);
    return listResource(client, resourceType, filter);
  }),
  });
};

export const getResourceTool = (
  client: WordPressClient,
  options?: ResourceToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Get a single WordPress media item, comment, or user',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createGetInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    return getResource(client, resolveResourceType(merged, options), merged);
  }),
  });
};

export const createResourceTool = (
  client: WordPressClient,
  options?: ResourceMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Create a WordPress comment or user',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createCreateInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return createResource(client, resolveResourceType(merged, options), withInput.input as Record<string, unknown>);
  }),
  });
};

export const updateResourceTool = (
  client: WordPressClient,
  options?: ResourceMutationToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Update a WordPress comment or user',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createUpdateInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return updateResource(client, resolveResourceType(merged, options), withInput.id as number, withInput.input as Record<string, unknown>);
  }),
  });
};

export const deleteResourceTool = (
  client: WordPressClient,
  options?: ResourceToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = { ...options, catalog: options?.catalog ?? client.getCachedCatalog() };
  return tool({
  description: options?.description ?? 'Delete a WordPress media item, comment, or user',
  strict: options?.strict,
  needsApproval: options?.needsApproval as never,
  inputSchema: (options?.inputSchema ?? createDeleteInputSchema(resolvedOptions)) as never,
  execute: withToolErrorHandling(async (args: unknown) => {
    const merged = mergeToolArgs(asToolArgs(args as Record<string, unknown>), options?.fixedArgs);
    return deleteResource(client, resolveResourceType(merged, options), merged);
  }),
  });
};
