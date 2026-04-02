import {
  createWordPressBlockJsonSchema,
  createWordPressBlockJsonSchemas,
  type WordPressBlockJsonSchema,
} from '../blocks.js';
import { filterToParams } from '../core/params.js';
import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressBlockType } from '../schemas.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import type {
  BlocksResourceClient,
  QueryParams,
  WordPressRequestOverrides,
} from '../types/resources.js';

/**
 * Narrow error check used to turn 404s into `undefined` item lookups.
 */
function isNotFoundError(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/**
 * Validates a WordPress block type name matches the expected namespace/block-name pattern.
 */
const BLOCK_NAME_PATTERN = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;

/**
 * Normalizes a block type name into its REST item endpoint.
 * Validates the name against the WordPress block name pattern to prevent path traversal.
 */
function createBlockTypeItemEndpoint(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error('Block type name must not be empty.');
  }

  if (!BLOCK_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid block type name "${trimmed}". Expected format: "namespace/block-name" (lowercase alphanumeric and hyphens).`,
    );
  }

  const [namespace, blockName] = trimmed.split('/');

  return `/block-types/${encodeURIComponent(namespace!)}/${encodeURIComponent(blockName!)}`;
}

/**
 * Read-only resource wrapper for `/wp/v2/block-types`.
 */
export class BlockTypesResource {
  constructor(private readonly runtime: WordPressRuntime) {}

  /**
   * Lists block types.
   */
  async list(filter: QueryParams = {}, options?: WordPressRequestOverrides): Promise<WordPressBlockType[]> {
    const params = filterToParams(filter, { applyPerPageDefault: false });
    return this.runtime.fetchAPI<WordPressBlockType[]>('/block-types', params, options);
  }

  /**
   * Reads one block type by its fully qualified name.
   */
  async item(
    name: string,
    options?: WordPressRequestOverrides & { context?: 'view' | 'embed' | 'edit'; fields?: string[] },
  ): Promise<WordPressBlockType | undefined> {
    const { context, fields, ...requestOptions } = options || {};
    const params = filterToParams({ context, fields }, { applyPerPageDefault: false });

    try {
      return await this.runtime.fetchAPI<WordPressBlockType>(
        createBlockTypeItemEndpoint(name),
        params,
        requestOptions,
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }

      throw error;
    }
  }
}

/**
 * Creates the public client facade for block type discovery.
 */
export function createBlocksClient(
  resource: BlockTypesResource,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): BlocksResourceClient<WordPressBlockType, QueryParams> {
  return {
    list: (filter = {}, options) => resource.list(filter, options),
    item: (name, options) => resource.item(name, options),
    schema: async (name, options): Promise<WordPressBlockJsonSchema | undefined> => {
      const blockType = await resource.item(name, options);
      return blockType ? createWordPressBlockJsonSchema(blockType) : undefined;
    },
    schemas: async (filter = {}, options): Promise<WordPressBlockJsonSchema[]> => {
      const blockTypes = await resource.list(filter, options);
      return createWordPressBlockJsonSchemas(blockTypes);
    },
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
