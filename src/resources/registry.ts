import type { WordPressRuntime } from '../core/transport.js';
import type { WordPressPostLike, WordPressCategory } from '../schemas.js';
import type {
  ContentResourceClient,
  PaginationParams,
  QueryParams,
  TermsResourceClient,
} from '../types/resources.js';
import type { TermWriteInput, WordPressWritePayload } from '../types/payloads.js';
import { createDiscoveryMethods, type DiscoveryMethods } from '../discovery.js';
import {
  GenericContentResource,
  createContentClient,
  knownContentDefaults,
} from './content.js';
import {
  GenericTermResource,
  createTermsClient,
} from './terms.js';

/**
 * Runtime dependencies required for generic content and term resources.
 */
export interface GenericResourceContext {
  runtime: WordPressRuntime;
  discoveryMethods?: DiscoveryMethods;
}

/**
 * Registry for managing generic content and term resources.
 */
export class GenericResourceRegistry {
  private readonly contentCache = new Map<string, GenericContentResource>();
  private readonly termCache = new Map<string, GenericTermResource>();
  private readonly discoveryMethods: ReturnType<typeof createDiscoveryMethods>;

  constructor(private readonly context: GenericResourceContext) {
    this.discoveryMethods = context.discoveryMethods ?? createDiscoveryMethods(context.runtime);
  }

  /**
   * Gets or creates one post-like content resource client.
   */
  content<TResource extends WordPressPostLike = WordPressPostLike>(
    resource: string,
  ): ContentResourceClient<TResource, QueryParams & PaginationParams, WordPressWritePayload, WordPressWritePayload> {
    const cacheKey = `${resource}:raw`;
    let baseResource = this.contentCache.get(cacheKey) as GenericContentResource<TResource> | undefined;

    if (!baseResource) {
      const defaults = knownContentDefaults[resource as keyof typeof knownContentDefaults];

      baseResource = new GenericContentResource<TResource>({
        runtime: this.context.runtime,
        endpoint: `/${resource}`,
        missingRawMessage: defaults?.missingRawMessage
          ?? `Raw ${resource} content is unavailable. The current credentials may not have edit capabilities.`,
      });

      this.contentCache.set(cacheKey, baseResource as GenericContentResource);
    }

    return createContentClient(baseResource, (options) =>
      this.discoveryMethods.describeContent(resource, options),
    );
  }

  /**
   * Gets or creates one generic term resource client.
   */
  terms<TTerm = WordPressCategory>(
    resource: string,
  ): TermsResourceClient<TTerm, QueryParams & PaginationParams, TermWriteInput, TermWriteInput> {
    const cacheKey = `${resource}:raw`;
    let baseResource = this.termCache.get(cacheKey) as GenericTermResource<TTerm> | undefined;

    if (!baseResource) {
      baseResource = new GenericTermResource<TTerm>({
        runtime: this.context.runtime,
        endpoint: `/${resource}`,
      });

      this.termCache.set(cacheKey, baseResource as GenericTermResource);
    }

    return createTermsClient(baseResource, (options) =>
      this.discoveryMethods.describeTerm(resource, options),
    );
  }
}
