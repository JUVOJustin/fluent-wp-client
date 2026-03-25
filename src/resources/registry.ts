import type { WordPressBlockParser } from '../blocks.js';
import type { PostRelationClient } from '../builders/relations.js';
import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type { WordPressPostLike, WordPressCategory } from '../schemas.js';
import type {
  ContentResourceClient,
  PaginationParams,
  QueryParams,
  TermsResourceClient,
} from '../types/resources.js';
import type { TermWriteInput, WordPressWritePayload } from '../types/payloads.js';
import { createDiscoveryMethods } from '../discovery.js';
import {
  GenericContentResource,
  createContentClient,
  knownContentDefaults,
} from './content.js';
import {
  GenericTermResource,
  createTermsClient,
  knownTermDefaults,
} from './terms.js';

/**
 * Runtime dependencies required for generic content and term resources.
 */
export interface GenericResourceContext {
  runtime: WordPressRuntime;
  relationClient: PostRelationClient;
  defaultBlockParser?: WordPressBlockParser;
}

/**
 * Registry for managing generic content and term resources.
 */
export class GenericResourceRegistry {
  private readonly contentCache = new Map<string, GenericContentResource>();
  private readonly termCache = new Map<string, GenericTermResource>();
  private readonly discoveryMethods: ReturnType<typeof createDiscoveryMethods>;

  constructor(private readonly context: GenericResourceContext) {
    this.discoveryMethods = createDiscoveryMethods(context.runtime);
  }

  /**
   * Gets or creates one post-like content resource client.
   */
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TResource>,
  ): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
    const cacheKey = responseSchema ? null : `${resource}:raw`;

    let baseResource: GenericContentResource<TResource> | undefined;

    if (cacheKey) {
      baseResource = this.contentCache.get(cacheKey) as GenericContentResource<TResource> | undefined;
    }

    if (!baseResource) {
      const defaults = knownContentDefaults[resource as keyof typeof knownContentDefaults];

      // @ts-ignore - Type complexity at generic boundaries
      baseResource = new GenericContentResource<TResource>({
        runtime: this.context.runtime,
        relationClient: this.context.relationClient,
        endpoint: `/${resource}`,
        defaultBlockParser: this.context.defaultBlockParser,
        defaultSchema: defaults?.defaultSchema as WordPressStandardSchema<TResource> | undefined,
        missingRawMessage: defaults?.missingRawMessage
          ?? `Raw ${resource} content is unavailable. The current credentials may not have edit capabilities.`,
        responseSchema: responseSchema as WordPressStandardSchema<WordPressPostLike> | undefined,
      } as any);

      if (cacheKey) {
        this.contentCache.set(cacheKey, baseResource as GenericContentResource);
      }
    }

    return createContentClient(baseResource, responseSchema, (options) =>
      this.discoveryMethods.describeContent(resource, options),
    );
  }

  /**
   * Gets or creates one generic term resource client.
   */
  terms<TTerm = WordPressCategory>(
    resource: string,
    responseSchema?: WordPressStandardSchema<TTerm>,
  ): TermsResourceClient<TTerm, QueryParams & PaginationParams, TermWriteInput, TermWriteInput> {
    const cacheKey = responseSchema ? null : `${resource}:raw`;

    let baseResource: GenericTermResource<TTerm> | undefined;

    if (cacheKey) {
      baseResource = this.termCache.get(cacheKey) as GenericTermResource<TTerm> | undefined;
    }

    if (!baseResource) {
      const defaults = knownTermDefaults[resource as keyof typeof knownTermDefaults];

      baseResource = new GenericTermResource<TTerm>({
        runtime: this.context.runtime,
        endpoint: `/${resource}`,
        defaultSchema: defaults?.defaultSchema as WordPressStandardSchema<TTerm> | undefined,
        responseSchema,
      });

      if (cacheKey) {
        this.termCache.set(cacheKey, baseResource as GenericTermResource);
      }
    }

    return createTermsClient(baseResource, responseSchema, (options) =>
      this.discoveryMethods.describeTerm(resource, options),
    );
  }
}
