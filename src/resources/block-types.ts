import {
  createWordPressBlockJsonSchema,
  createWordPressBlockJsonSchemas,
  type WordPressBlockJsonSchema,
} from '../blocks.js';
import { filterToParams } from '../core/params.js';
import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { blockTypeSchema } from '../standard-schemas.js';
import type { WordPressBlockType } from '../schemas.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import type {
  BlocksResourceClient,
  QueryParams,
  WordPressRequestOverrides,
} from '../types/resources.js';
import {
  createSchemaValidators,
  shouldSkipValidation,
} from './schema-validation.js';

/**
 * Narrow error check used to turn 404s into `undefined` item lookups.
 */
function isNotFoundError(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/**
 * Normalizes a block type name into its REST item endpoint.
 */
function createBlockTypeItemEndpoint(name: string): string {
  const trimmed = name.replace(/^\/+|\/+$/g, '');

  if (!trimmed) {
    throw new Error('Block type name must not be empty.');
  }

  return `/block-types/${trimmed}`;
}

/**
 * Read-only resource wrapper for `/wp/v2/block-types`.
 */
export class BlockTypesResource<TResource extends WordPressBlockType = WordPressBlockType> {
  private readonly hasExplicitResponseSchema: boolean;
  private readonly validators: ReturnType<typeof createSchemaValidators<TResource>>;

  constructor(
    private readonly runtime: WordPressRuntime,
    responseSchema?: WordPressStandardSchema<TResource>,
  ) {
    this.hasExplicitResponseSchema = responseSchema !== undefined;
    this.validators = createSchemaValidators(
      (responseSchema ?? blockTypeSchema) as WordPressStandardSchema<TResource>,
      'Block type response validation failed',
    );
  }

  /**
   * Lists block types with optional schema validation.
   */
  async list(filter: QueryParams = {}, options?: WordPressRequestOverrides): Promise<TResource[]> {
    const params = filterToParams(filter, { applyPerPageDefault: false });
    const items = await this.runtime.fetchAPI<TResource[]>('/block-types', params, options);

    if (shouldSkipValidation(this.hasExplicitResponseSchema, filter)) {
      return items as TResource[];
    }

    return this.validators.validateCollection(items as unknown[]);
  }

  /**
   * Reads one block type by its fully qualified name.
   */
  async item(
    name: string,
    options?: WordPressRequestOverrides & { context?: 'view' | 'embed' | 'edit'; fields?: string[] },
  ): Promise<TResource | undefined> {
    const { context, fields, ...requestOptions } = options || {};
    const params = filterToParams({ context, fields }, { applyPerPageDefault: false });

    try {
      const item = await this.runtime.fetchAPI<TResource>(
        createBlockTypeItemEndpoint(name),
        params,
        requestOptions,
      );

      if (shouldSkipValidation(this.hasExplicitResponseSchema, { fields })) {
        return item as TResource;
      }

      return this.validators.validate(item as unknown);
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
export function createBlocksClient<TResource extends WordPressBlockType = WordPressBlockType>(
  resource: BlockTypesResource<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): BlocksResourceClient<TResource, QueryParams> {
  return {
    list: (filter = {}, options) => resource.list(filter, options),
    item: (name, options) => resource.item(name, options),
    schema: async (name, options): Promise<WordPressBlockJsonSchema | undefined> => {
      const blockType = await resource.item(name, options);
      return blockType ? createWordPressBlockJsonSchema(blockType as unknown as WordPressBlockType) : undefined;
    },
    schemas: async (filter = {}, options): Promise<WordPressBlockJsonSchema[]> => {
      const blockTypes = await resource.list(filter, options);
      return createWordPressBlockJsonSchemas(blockTypes as unknown as WordPressBlockType[]);
    },
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
