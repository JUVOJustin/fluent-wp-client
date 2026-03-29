import { PostRelationQueryBuilder } from './builders/relations.js';
import type {
  AllPostRelations,
  ContentItemResult,
} from './builders/relations.js';
import { WordPressClient } from './client.js';
import { type WordPressRawContentResult } from './content-query.js';
import { ExecutableQuery } from './core/query-base.js';
import type { WordPressRuntime } from './core/transport.js';
import type { WordPressStandardSchema } from './core/validation.js';
import { BlockTypesResource, createBlocksClient } from './resources/block-types.js';
import type {
  WordPressBlockType,
  WordPressPage,
  WordPressPost,
  WordPressPostLike,
  WordPressPostWriteBase,
} from './schemas.js';
import type {
  BlockTypesFilter,
  PagesFilter,
  PostsFilter,
} from './types/filters.js';
import type {
  BlocksResourceClient,
  ContentResourceClient,
  ExtensibleFilter,
  PaginationParams,
  QueryParams,
  WordPressRequestOverrides,
} from './types/resources.js';
import type { WordPressWritePayload } from './types/payloads.js';
import {
  assertValidWordPressBlocks,
  parseWordPressBlocks,
  serializeWordPressBlocks,
  type WordPressGetBlocksOptions,
  type WordPressBlockJsonSchema,
  type WordPressParsedBlock,
  type WordPressSetBlocksOptions,
} from './blocks.js';
import { createDiscoveryMethods } from './discovery.js';

const blocksResourceCache = new WeakMap<WordPressClient, BlockTypesResource>();

/**
 * Normalizes the optional second `set()` argument so callers can pass schemas directly.
 */
function normalizeSetBlocksOptions(
  options?: WordPressBlockJsonSchema[] | WordPressSetBlocksOptions,
): WordPressSetBlocksOptions {
  return Array.isArray(options)
    ? { schemas: options }
    : options ?? {};
}

/**
 * Promise-like query that adds a dedicated `.blocks()` namespace on top of one content item query.
 */
export class BlockContentItemQuery<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressPostLike = WordPressPostLike,
  TFilter extends QueryParams & PaginationParams = QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload = WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> extends ExecutableQuery<ContentItemResult<TContent, TRelations> | undefined> {
  constructor(
    private readonly resource: string,
    private readonly selector: number | string,
    private readonly contentClient: ContentResourceClient<TContent, TFilter, TCreate, TUpdate>,
    private readonly baseQuery: PostRelationQueryBuilder<TRelations, TContent>,
  ) {
    super();
  }

  /**
   * Adds relation names to the underlying content query while preserving the block namespace.
   */
  with<TNext extends readonly AllPostRelations[]>(
    ...relations: TNext
  ): BlockContentItemQuery<[...TRelations, ...TNext], TContent, TFilter, TCreate, TUpdate> {
    return new BlockContentItemQuery(
      this.resource,
      this.selector,
      this.contentClient,
      this.baseQuery.with(...relations),
    );
  }

  /**
   * Resolves raw and rendered content from one edit-context request.
   */
  getContent(): Promise<WordPressRawContentResult | undefined> {
    return this.baseQuery.getContent();
  }

  /**
   * Exposes explicit block read and write helpers under one dedicated namespace.
   */
  blocks() {
    return {
      get: async (options: WordPressGetBlocksOptions = {}): Promise<WordPressParsedBlock[] | undefined> => {
        const content = await this.baseQuery.getContent();

        if (!content) {
          return undefined;
        }

        const blocks = await parseWordPressBlocks(content.raw, options.parser);
        const shouldValidate = options.validate ?? options.schemas !== undefined;

        if (shouldValidate) {
          await assertValidWordPressBlocks(blocks, { parser: options.parser, schemas: options.schemas });
        }

        return blocks;
      },
      set: async (
        blocks: WordPressParsedBlock[],
        options?: WordPressBlockJsonSchema[] | WordPressSetBlocksOptions,
      ): Promise<TContent> => {
        const normalizedOptions = normalizeSetBlocksOptions(options);
        const postId = await this.resolveSelectedPostId();

        if (postId === undefined) {
          throw new Error('Cannot set blocks because the selected content item could not be found.');
        }

        if (normalizedOptions.validate !== false) {
          await assertValidWordPressBlocks(blocks, {
            parser: normalizedOptions.parser,
            schemas: normalizedOptions.schemas,
          });
        }

        const content = serializeWordPressBlocks(blocks);
        return this.contentClient.update(postId, { content } as unknown as TUpdate);
      },
    };
  }

  /**
   * Resolves the selected content ID so block updates can target the correct REST item route.
   */
  private async resolveSelectedPostId(): Promise<number | undefined> {
    if (typeof this.selector === 'number') {
      return this.selector;
    }

    const selected = await this.contentClient.item(this.selector, { fields: ['id'] });
    return selected?.id;
  }

  /**
   * Delegates execution to the underlying relation query builder.
   */
  protected execute(): Promise<ContentItemResult<TContent, TRelations> | undefined> {
    return Promise.resolve(this.baseQuery) as Promise<ContentItemResult<TContent, TRelations> | undefined>;
  }
}

/**
 * Block-aware content client that keeps the normal content API and adds `.blocks()` on item queries.
 */
export type BlockAwareContentResourceClient<
  TResource extends WordPressPostLike,
  TFilter extends QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
> = Omit<ContentResourceClient<TResource, TFilter, TCreate, TUpdate>, 'item'> & {
  item: (
    idOrSlug: number | string,
    options?: WordPressRequestOverrides & { embed?: boolean; fields?: string[] },
  ) => BlockContentItemQuery<[], TResource, TFilter, TCreate, TUpdate>;
};

/**
 * Public block-aware extension surface layered on top of the core client.
 */
export interface WordPressBlocksExtension {
  readonly baseClient: WordPressClient;
  blocks(): BlocksResourceClient<WordPressBlockType, ExtensibleFilter<BlockTypesFilter>>;
  blocks<TResource extends WordPressBlockType>(
    responseSchema: WordPressStandardSchema<TResource>,
  ): BlocksResourceClient<TResource, ExtensibleFilter<BlockTypesFilter>>;
  content(
    resource: 'posts',
  ): BlockAwareContentResourceClient<WordPressPost, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike>(
    resource: 'posts',
    responseSchema: WordPressStandardSchema<TResource>,
  ): BlockAwareContentResourceClient<TResource, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content(
    resource: 'pages',
  ): BlockAwareContentResourceClient<WordPressPage, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike>(
    resource: 'pages',
    responseSchema: WordPressStandardSchema<TResource>,
  ): BlockAwareContentResourceClient<TResource, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): BlockAwareContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload>;
}

/**
 * Block-aware client type that preserves the base client API while overriding `content()` and adding `blocks()`.
 */
export type WordPressBlocksClient<TClient extends WordPressClient = WordPressClient> = Omit<TClient, keyof WordPressBlocksExtension>
  & WordPressBlocksExtension
  & { readonly baseClient: TClient };

/**
 * Returns the client's internal runtime for use by block resource helpers.
 */
function getClientRuntime(client: WordPressClient): WordPressRuntime {
  return client.getRuntime();
}

/**
 * Creates one block-aware wrapper around a standard content resource client.
 */
function createBlockAwareContentClient<
  TResource extends WordPressPostLike,
  TFilter extends QueryParams & PaginationParams,
  TCreate extends WordPressWritePayload,
  TUpdate extends WordPressWritePayload = TCreate,
>(
  resource: string,
  baseContentClient: ContentResourceClient<TResource, TFilter, TCreate, TUpdate>,
): BlockAwareContentResourceClient<TResource, TFilter, TCreate, TUpdate> {
  return {
    ...baseContentClient,
    item: (idOrSlug, options) => new BlockContentItemQuery(
      resource,
      idOrSlug,
      baseContentClient,
      baseContentClient.item(idOrSlug, options),
    ),
  };
}

/**
 * Internal implementation that powers the proxy-backed block extension.
 */
class WordPressBlocksSupport {
  private readonly runtime: WordPressRuntime;

  constructor(readonly baseClient: WordPressClient) {
    this.runtime = getClientRuntime(baseClient);
  }

  blocks(): BlocksResourceClient<WordPressBlockType, ExtensibleFilter<BlockTypesFilter>>;
  blocks<TResource extends WordPressBlockType>(
    responseSchema: WordPressStandardSchema<TResource>,
  ): BlocksResourceClient<TResource, ExtensibleFilter<BlockTypesFilter>>;
  blocks<TResource extends WordPressBlockType = WordPressBlockType>(
    responseSchema?: WordPressStandardSchema<TResource>,
  ): BlocksResourceClient<TResource, ExtensibleFilter<BlockTypesFilter>> {
    const discoveryMethods = createDiscoveryMethods(this.runtime);
    const cachedResource = blocksResourceCache.get(this.baseClient);
    const resource = responseSchema
      ? new BlockTypesResource(this.runtime, responseSchema)
      : (cachedResource ?? new BlockTypesResource(this.runtime)) as BlockTypesResource<TResource>;

    if (!cachedResource && !responseSchema) {
      blocksResourceCache.set(this.baseClient, resource as unknown as BlockTypesResource);
    }

    return createBlocksClient(
      resource,
      (options) => discoveryMethods.describeResource('block-types', options),
    );
  }

  content(
    resource: 'posts',
  ): BlockAwareContentResourceClient<WordPressPost, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike>(
    resource: 'posts',
    responseSchema: WordPressStandardSchema<TResource>,
  ): BlockAwareContentResourceClient<TResource, ExtensibleFilter<PostsFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content(
    resource: 'pages',
  ): BlockAwareContentResourceClient<WordPressPage, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike>(
    resource: 'pages',
    responseSchema: WordPressStandardSchema<TResource>,
  ): BlockAwareContentResourceClient<TResource, ExtensibleFilter<PagesFilter>, WordPressPostWriteBase, WordPressPostWriteBase>;
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): BlockAwareContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
    return createBlockAwareContentClient(
      resource,
      this.baseClient.content(resource, responseSchema),
    );
  }
}

const blocksClientCache = new WeakMap<WordPressClient, WordPressBlocksClient>();

/**
 * Wraps a core client instance with portable Gutenberg block helpers.
 */
export function withBlocks<TClient extends WordPressClient>(client: TClient): WordPressBlocksClient<TClient> {
  const cached = blocksClientCache.get(client);

  if (cached) {
    return cached as WordPressBlocksClient<TClient>;
  }

  const support = new WordPressBlocksSupport(client);

  const proxy = new Proxy(client as unknown as WordPressBlocksClient<TClient>, {
    get(target, property, receiver) {
      if (property === 'baseClient') {
        return client;
      }

      if (property === 'blocks') {
        return support.blocks.bind(support);
      }

      if (property === 'content') {
        return support.content.bind(support);
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  blocksClientCache.set(client, proxy);
  return proxy;
}
