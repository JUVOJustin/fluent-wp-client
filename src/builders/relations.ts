import {
  type WordPressAuthor,
  type WordPressCategory,
  type WordPressContent,
  type WordPressMedia,
  type WordPressPost,
  type WordPressTag,
  embeddedMediaSchema,
} from '../schemas.js';
import {
  customRelationRegistry,
  defaultParseReferenceId,
  type CustomRelationConfig,
  type PostRelationClient,
  type RelatedTermReference,
  extractEmbeddedData,
  createArrayExtractor,
  createSingleExtractor,
  toRelatedTermReference,
} from './relation-resolvers.js';

/**
 * Supported relation names for fluent post hydration (built-in).
 */
export type PostRelation = 'author' | 'categories' | 'tags' | 'terms' | 'featuredMedia';

/**
 * All available relations including built-in and custom registered ones.
 * This is a union type that expands at runtime as custom relations are registered.
 */
export type AllPostRelations = PostRelation | string;

/**
 * Helper map used to derive relation result types for built-in relations.
 */
interface PostRelationMap {
  author: WordPressAuthor | null;
  categories: WordPressCategory[];
  tags: WordPressTag[];
  terms: {
    categories: WordPressCategory[];
    tags: WordPressTag[];
    taxonomies: Record<string, RelatedTermReference[]>;
  };
  featuredMedia: WordPressMedia | null;
}

/**
 * Simplifies intersection output for cleaner consumer hover types.
 */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Converts a union to an intersection for selected relation keys.
 */
type UnionToIntersection<T> =
  (T extends unknown ? (value: T) => void : never) extends ((value: infer R) => void)
    ? R
    : never;

/**
 * Type for custom relation results (when using string relation names).
 */
export type CustomRelationResults = Record<string, unknown>;

/**
 * Builds the selected relation result type for fluent relation calls.
 * Supports both built-in relations and runtime-registered custom relations.
 */
export type SelectedPostRelations<TRelations extends readonly AllPostRelations[]> = 
  [TRelations[number]] extends [never]
    ? {}
    : Simplify<
        UnionToIntersection<
          TRelations[number] extends infer K
            ? K extends keyof PostRelationMap
              ? { [P in K]: PostRelationMap[P] }
              : K extends string
                ? { [P in K]: unknown }
                : never
            : never
        >
      >;

/**
 * Extracts the first author from an _embedded author array.
 */
const extractEmbeddedAuthor = createSingleExtractor(
  (item: unknown) => item as WordPressAuthor,
);

/**
 * Resolves one author by preferring direct lookup and then list fallback.
 */
async function resolveAuthor(client: PostRelationClient, authorId: number): Promise<WordPressAuthor | null> {
  const direct = await client.getUser(authorId).catch(() => null);

  if (direct) {
    return direct;
  }

  if (!client.getUsers) {
    return null;
  }

  const users = await client.getUsers({ include: [authorId], perPage: 1 }).catch(() => []);
  return users[0] ?? null;
}

/**
 * Extracts featured media from an _embedded wp:featuredmedia array.
 * Validates each item against embeddedMediaSchema before returning.
 */
const extractEmbeddedFeaturedMedia = createSingleExtractor((item: unknown) => {
  const result = embeddedMediaSchema.safeParse(item);
  return result.success ? (result.data as unknown as WordPressMedia) : null;
});

/**
 * Reads one numeric relation ID array from a content record.
 * Uses defaultParseReferenceId to handle both plain numbers and numeric strings.
 */
function getContentRelationIds(content: WordPressContent, field: string): number[] {
  const value = (content as Record<string, unknown>)[field];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(defaultParseReferenceId)
    .filter((id): id is number => id !== null);
}

/**
 * Resolves embedded taxonomy terms by taxonomy name.
 */
function getEmbeddedTerms(post: WordPressContent): {
  categories: WordPressCategory[];
  tags: WordPressTag[];
  taxonomies: Record<string, RelatedTermReference[]>;
} {
  const termGroups = extractEmbeddedData<unknown[][]>(post, 'wp:term');

  if (!Array.isArray(termGroups)) {
    return {
      categories: [],
      tags: [],
      taxonomies: {},
    };
  }

  const categories: WordPressCategory[] = [];
  const tags: WordPressTag[] = [];
  const taxonomies: Record<string, RelatedTermReference[]> = {};

  for (const group of termGroups) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const term of group as Array<Record<string, unknown>>) {
      if (typeof term.taxonomy !== 'string' || typeof term.id !== 'number') {
        continue;
      }

      if (!taxonomies[term.taxonomy]) {
        taxonomies[term.taxonomy] = [];
      }

      taxonomies[term.taxonomy].push(toRelatedTermReference(term as WordPressCategory));

      if (term.taxonomy === 'category') {
        categories.push(term as WordPressCategory);
      }

      if (term.taxonomy === 'post_tag') {
        tags.push(term as WordPressTag);
      }
    }
  }

  return {
    categories,
    tags,
    taxonomies,
  };
}

interface LinkedTermResource {
  taxonomy: string;
  resource: string;
}

/**
 * Resolves taxonomy resources from `_links['wp:term']`.
 */
function getLinkedTermResources(post: WordPressContent): LinkedTermResource[] {
  const links = (post as { _links?: Record<string, unknown> })._links?.['wp:term'];

  if (!Array.isArray(links)) {
    return [];
  }

  const resources = new Map<string, LinkedTermResource>();

  for (const link of links as Array<Record<string, unknown>>) {
    if (typeof link.taxonomy !== 'string' || typeof link.href !== 'string') {
      continue;
    }

    let resource: string | undefined;

    try {
      resource = new URL(link.href).pathname.split('/').filter(Boolean).pop();
    } catch {
      resource = undefined;
    }

    if (!resource) {
      continue;
    }

    resources.set(link.taxonomy, {
      taxonomy: link.taxonomy,
      resource,
    });
  }

  return Array.from(resources.values());
}

/**
 * Resolves missing taxonomy groups from linked term resources.
 */
async function resolveLinkedTerms(
  client: PostRelationClient,
  post: WordPressContent,
  existingTaxonomies: Record<string, RelatedTermReference[]>,
): Promise<Record<string, RelatedTermReference[]>> {
  if (!client.getTermCollection) {
    return {};
  }

  const linkedResources = getLinkedTermResources(post)
    .filter((entry) => !existingTaxonomies[entry.taxonomy] || existingTaxonomies[entry.taxonomy].length === 0);

  if (linkedResources.length === 0) {
    return {};
  }

  const resolved: Record<string, RelatedTermReference[]> = {};

  for (const entry of linkedResources) {
    try {
      const terms = await client.getTermCollection<WordPressCategory>(entry.resource, {
        post: post.id,
        perPage: 100,
      });
      resolved[entry.taxonomy] = terms.map(toRelatedTermReference);
    } catch {
      continue;
    }
  }

  return resolved;
}

/**
 * Gets the required fields for a relation to ensure they're not excluded.
 */
function getRequiredFieldsForRelations(relations: Set<AllPostRelations>): string[] {
  const fields = new Set<string>();
  
  // Built-in relation required fields
  const builtInFields: Record<string, string[]> = {
    author: ['author'],
    categories: ['categories'],
    tags: ['tags'],
    terms: ['categories', 'tags', '_links'],
    featuredMedia: ['featured_media'],
  };
  
  for (const relation of relations) {
    // Check built-in relations
    if (relation in builtInFields) {
      for (const field of builtInFields[relation]) {
        fields.add(field);
      }
    }
    
    // Check custom registered relations
    const customConfig = customRelationRegistry.get(relation);
    if (customConfig?.requiredFields) {
      for (const field of customConfig.requiredFields) {
        fields.add(field);
      }
    }
  }
  
  return Array.from(fields);
}

/**
 * Resolves a custom relation using its registered configuration.
 */
async function resolveCustomRelation<T>(
  config: CustomRelationConfig<T>,
  client: PostRelationClient,
  post: WordPressContent,
): Promise<T | null> {
  // Try to get embedded data first
  const embeddedData = extractEmbeddedData<unknown>(post, config.embeddedKey);
  
  if (embeddedData !== undefined) {
    const extracted = config.extractEmbedded(embeddedData);
    if (extracted !== null) {
      return extracted;
    }
  }
  
  // Fall back to API calls if available
  if (config.fallbackResolver) {
    try {
      return await config.fallbackResolver.resolve(client, post);
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Fluent builder that hydrates one post-like content record and selected related entities.
 * 
 * Supports both built-in relations (author, categories, tags, terms, featuredMedia)
 * and custom relations registered via `customRelationRegistry`.
 * 
 * @example
 * ```typescript
 * // Built-in relations
 * const post = await client
 *   .post('my-post')
 *   .with('author', 'categories')
 *   .get();
 * 
 * // Custom relations (e.g., ACF)
 * const post = await client
 *   .post('my-post')
 *   .with('linkedArticles', 'primaryArticle')
 *   .get();
 * ```
 */
export class PostRelationQueryBuilder<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressContent = WordPressPost,
> {
  private readonly relationSet: Set<AllPostRelations>;

  constructor(
    private readonly client: PostRelationClient,
    private readonly selector: { id?: number; slug?: string },
    private readonly getById: (id: number) => PromiseLike<TContent>,
    private readonly getBySlug: (slug: string) => PromiseLike<TContent | undefined>,
    relations: readonly AllPostRelations[] = [],
  ) {
    this.relationSet = new Set(relations);
  }

  /**
   * Adds relation names to the hydration plan.
   * 
   * Supports built-in relations: 'author', 'categories', 'tags', 'terms', 'featuredMedia'
   * Also supports custom relations registered via `customRelationRegistry`.
   */
  with<TNext extends readonly AllPostRelations[]>(
    ...relations: TNext
  ): PostRelationQueryBuilder<[...TRelations, ...TNext], TContent> {
    const nextRelations = new Set(this.relationSet);

    for (const relation of relations) {
      nextRelations.add(relation);
    }

    return new PostRelationQueryBuilder(
      this.client,
      this.selector,
      this.getById,
      this.getBySlug,
      Array.from(nextRelations),
    ) as PostRelationQueryBuilder<[...TRelations, ...TNext], TContent>;
  }

  /**
   * Fetches the selected post and resolves requested relations.
   * 
   * For each requested relation:
   * 1. Attempts to extract from `_embedded` data
   * 2. Falls back to API calls if configured
   * 3. Returns null/empty if unavailable
   * 
   * Custom relations are resolved using their registered configurations.
   */
  async get(): Promise<TContent & { related: SelectedPostRelations<TRelations> }> {
    let post: TContent | undefined;

    if (typeof this.selector.id === 'number') {
      post = await this.getById(this.selector.id);
    }

    if (!post && typeof this.selector.slug === 'string') {
      post = await this.getBySlug(this.selector.slug);
    }

    if (!post) {
      throw new Error('Post not found for the provided fluent relation selector.');
    }

    const related: Record<string, unknown> = {};
    const requestedTerms = this.relationSet.has('terms');
    const requestedCategories = requestedTerms || this.relationSet.has('categories');
    const requestedTags = requestedTerms || this.relationSet.has('tags');

    // Handle built-in author relation
    if (this.relationSet.has('author')) {
      const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(post, 'author'));
      related.author = embeddedAuthor ?? await resolveAuthor(this.client, post.author);
    }

    // Handle built-in featuredMedia relation
    if (this.relationSet.has('featuredMedia')) {
      const embeddedMedia = extractEmbeddedFeaturedMedia(extractEmbeddedData(post, 'wp:featuredmedia'));
      const featuredMediaId = post.featured_media;

      if (embeddedMedia) {
        related.featuredMedia = embeddedMedia;
      } else if (typeof featuredMediaId === 'number' && featuredMediaId > 0) {
        related.featuredMedia = await this.client.getMediaItem(featuredMediaId).catch(() => null);
      } else {
        related.featuredMedia = null;
      }
    }

    // Handle built-in terms relations — skip entirely when no term relation was requested.
    let categories: WordPressCategory[] = [];
    let tags: WordPressTag[] = [];
    let taxonomies: Record<string, RelatedTermReference[]> = {};

    if (requestedCategories || requestedTags) {
      const embeddedTerms = getEmbeddedTerms(post);
      categories = embeddedTerms.categories;
      tags = embeddedTerms.tags;
      taxonomies = { ...embeddedTerms.taxonomies };

      const categoryIds = getContentRelationIds(post, 'categories');
      const tagIds = getContentRelationIds(post, 'tags');

      if (requestedCategories && categories.length === 0 && categoryIds.length > 0) {
        categories = await this.client.getCategories({ include: categoryIds }).catch(() => []);
      }

      if (requestedTags && tags.length === 0 && tagIds.length > 0) {
        tags = await this.client.getTags({ include: tagIds }).catch(() => []);
      }

      if (categories.length > 0) {
        taxonomies = {
          ...taxonomies,
          category: categories.map(toRelatedTermReference),
        };
      }

      if (tags.length > 0) {
        taxonomies = {
          ...taxonomies,
          post_tag: tags.map(toRelatedTermReference),
        };
      }

      if (requestedTerms) {
        taxonomies = {
          ...taxonomies,
          ...await resolveLinkedTerms(this.client, post, taxonomies),
        };
      }
    }

    if (this.relationSet.has('categories')) {
      related.categories = categories;
    }

    if (this.relationSet.has('tags')) {
      related.tags = tags;
    }

    if (requestedTerms) {
      related.terms = { categories, tags, taxonomies };
    }

    // Handle custom registered relations
    for (const relationName of this.relationSet) {
      // Skip built-in relations
      if (['author', 'categories', 'tags', 'terms', 'featuredMedia'].includes(relationName)) {
        continue;
      }
      
      // Look up custom relation configuration
      const customConfig = customRelationRegistry.get(relationName);
      if (customConfig) {
        related[relationName] = await resolveCustomRelation(customConfig, this.client, post);
      }
    }

    return {
      ...post,
      related: related as SelectedPostRelations<TRelations>,
    };
  }

  /**
   * Gets the list of required fields for the current relations.
   * Useful for ensuring fields aren't excluded when using _fields filter.
   */
  getRequiredFields(): string[] {
    return getRequiredFieldsForRelations(this.relationSet);
  }
}

// Re-export types for consumers
export type {
  PostRelationClient,
  CustomRelationConfig,
  CustomRelationRegistry,
  EmbeddedDataExtractor,
  RelationFallbackResolver,
  IdCollectionRelationOptions,
  IdSingleRelationOptions,
  LinkedEmbeddedCollectionRelationOptions,
  LinkedEmbeddedSingleRelationOptions,
  RelatedContentReference,
  RelatedPostReference,
  RelatedTermReference,
} from './relation-resolvers.js';

export {
  customRelationRegistry,
  createArrayExtractor,
  createSingleExtractor,
  createIdCollectionRelation,
  createIdSingleRelation,
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
  defaultParseLinkId,
  defaultParseReferenceId,
  extractEmbeddedData,
  getEmbeddedRelationItems,
  getLinkedRelationIds,
  resolveContentReference,
  resolveContentReferences,
  resolvePostReference,
  resolvePostReferences,
  resolveTermReference,
  resolveTermReferences,
  toRelatedContentReference,
  toRelatedPostReference,
  toRelatedTermReference,
} from './relation-resolvers.js';
