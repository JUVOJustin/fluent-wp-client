import {
  type WordPressAuthor,
  type WordPressCategory,
  type WordPressMedia,
  type WordPressPost,
  type WordPressPostLike,
  type WordPressTag,
  embeddedMediaSchema,
} from '../schemas.js';
import {
  customRelationRegistry,
  defaultParseReferenceId,
  extractEmbeddedData,
  createSingleExtractor,
  toRelatedTermReference,
  type CustomRelationConfig,
  type PostRelationClient,
  type RelatedTermReference,
} from './relation-contracts.js';

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
 * Tracks the built-in relation names so custom relation loops can skip them.
 */
const BUILT_IN_RELATION_NAMES = new Set<PostRelation>([
  'author',
  'categories',
  'tags',
  'terms',
  'featuredMedia',
]);

/**
 * Lists the response fields each built-in relation needs for fallback hydration.
 */
const BUILT_IN_RELATION_FIELDS: Record<PostRelation, readonly string[]> = {
  author: ['author'],
  categories: ['categories'],
  tags: ['tags'],
  terms: ['categories', 'tags', '_links'],
  featuredMedia: ['featured_media'],
};

/**
 * Bundles the resolved built-in term relation groups for one post.
 */
interface ResolvedTermRelations {
  categories: WordPressCategory[];
  tags: WordPressTag[];
  taxonomies: Record<string, RelatedTermReference[]>;
}

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
 * Extracts featured media from an _embedded wp:featuredmedia array.
 * Validates each item against embeddedMediaSchema before returning.
 */
const extractEmbeddedFeaturedMedia = createSingleExtractor((item: unknown) => {
  const result = embeddedMediaSchema.safeParse(item);
  return result.success ? (result.data as unknown as WordPressMedia) : null;
});

/**
 * Coordinates built-in taxonomy relation hydration for one post response.
 */
class PostTermRelationsResolver {
  constructor(
    private readonly client: PostRelationClient,
    private readonly post: WordPressPostLike,
  ) {}

  /**
   * Reads numeric relation IDs from one post field.
   */
  private getContentRelationIds(field: string): number[] {
    const value = (this.post as Record<string, unknown>)[field];

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(defaultParseReferenceId)
      .filter((id): id is number => id !== null);
  }

  /**
   * Reads embedded taxonomy groups from the current post response.
   */
  private getEmbeddedTerms(): ResolvedTermRelations {
    const termGroups = extractEmbeddedData<unknown[][]>(this.post, 'wp:term');

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

  /**
   * Reads linked taxonomy resources from the current post response.
   */
  private getLinkedTermResources(): Array<{ taxonomy: string; resource: string }> {
    const links = (this.post as { _links?: Record<string, unknown> })._links?.['wp:term'];

    if (!Array.isArray(links)) {
      return [];
    }

    const resources = new Map<string, { taxonomy: string; resource: string }>();

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
   * Fetches categories through the client fallback API.
   */
  private async fetchCategories(ids: number[]): Promise<WordPressCategory[]> {
    return this.client.getCategories({ include: ids }).catch(() => []);
  }

  /**
   * Fetches tags through the client fallback API.
   */
  private async fetchTags(ids: number[]): Promise<WordPressTag[]> {
    return this.client.getTags({ include: ids }).catch(() => []);
  }

  /**
   * Replaces one taxonomy bucket with the latest resolved references.
   */
  private withTaxonomy(
    taxonomies: Record<string, RelatedTermReference[]>,
    taxonomy: string,
    terms: RelatedTermReference[],
  ): Record<string, RelatedTermReference[]> {
    if (terms.length === 0) {
      return taxonomies;
    }

    return {
      ...taxonomies,
      [taxonomy]: terms,
    };
  }

  /**
   * Resolves missing taxonomy groups from linked term resources.
   */
  private async resolveLinkedTerms(
    existingTaxonomies: Record<string, RelatedTermReference[]>,
  ): Promise<Record<string, RelatedTermReference[]>> {
    if (!this.client.terms) {
      return {};
    }

    const linkedResources = this.getLinkedTermResources()
      .filter((entry) => !existingTaxonomies[entry.taxonomy] || existingTaxonomies[entry.taxonomy].length === 0);

    if (linkedResources.length === 0) {
      return {};
    }

    const resolved: Record<string, RelatedTermReference[]> = {};

    for (const entry of linkedResources) {
      try {
        const terms = await this.client.terms<WordPressCategory>(entry.resource).list({
          post: this.post.id,
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
   * Resolves the requested term relation groups for the configured post.
   */
  async resolve(options: {
    includeCategories: boolean;
    includeTags: boolean;
    includeTerms: boolean;
  }): Promise<ResolvedTermRelations> {
    if (!options.includeCategories && !options.includeTags) {
      return {
        categories: [],
        tags: [],
        taxonomies: {},
      };
    }

    let { categories, tags, taxonomies } = this.getEmbeddedTerms();
    const categoryIds = this.getContentRelationIds('categories');
    const tagIds = this.getContentRelationIds('tags');

    if (options.includeCategories && categories.length === 0 && categoryIds.length > 0) {
      categories = await this.fetchCategories(categoryIds);
    }

    if (options.includeTags && tags.length === 0 && tagIds.length > 0) {
      tags = await this.fetchTags(tagIds);
    }

    taxonomies = this.withTaxonomy(
      taxonomies,
      'category',
      categories.map(toRelatedTermReference),
    );
    taxonomies = this.withTaxonomy(
      taxonomies,
      'post_tag',
      tags.map(toRelatedTermReference),
    );

    if (options.includeTerms) {
      taxonomies = {
        ...taxonomies,
        ...await this.resolveLinkedTerms(taxonomies),
      };
    }

    return {
      categories,
      tags,
      taxonomies,
    };
  }
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
  TContent extends WordPressPostLike = WordPressPost,
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
   * Loads the selected post by ID or slug.
   */
  private async loadSelectedPost(): Promise<TContent> {
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

    return post;
  }

  /**
   * Resolves one author by preferring direct lookup and then list fallback.
   */
  private async fetchAuthorById(authorId: number): Promise<WordPressAuthor | null> {
    const direct = await this.client.getUser(authorId).catch(() => null);

    if (direct) {
      return direct;
    }

    if (!this.client.getUsers) {
      return null;
    }

    const users = await this.client.getUsers({ include: [authorId], perPage: 1 }).catch(() => []);
    return users[0] ?? null;
  }

  /**
   * Resolves the built-in author relation for one post.
   */
  private async resolveAuthorRelation(post: TContent): Promise<WordPressAuthor | null> {
    const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(post, 'author'));
    const authorId = post.author;

    if (embeddedAuthor) {
      return embeddedAuthor;
    }

    return typeof authorId === 'number'
      ? this.fetchAuthorById(authorId)
      : null;
  }

  /**
   * Resolves the built-in featured media relation for one post.
   */
  private async resolveFeaturedMediaRelation(post: TContent): Promise<WordPressMedia | null> {
    const embeddedMedia = extractEmbeddedFeaturedMedia(extractEmbeddedData(post, 'wp:featuredmedia'));
    const featuredMediaId = post.featured_media;

    if (embeddedMedia) {
      return embeddedMedia;
    }

    if (typeof featuredMediaId === 'number' && featuredMediaId > 0) {
      return this.client.getMediaItem(featuredMediaId).catch(() => null);
    }

    return null;
  }

  /**
   * Resolves the requested taxonomy relation groups for one post.
   */
  private async resolveRequestedTerms(post: TContent): Promise<ResolvedTermRelations> {
    return new PostTermRelationsResolver(this.client, post).resolve({
      includeCategories: this.relationSet.has('terms') || this.relationSet.has('categories'),
      includeTags: this.relationSet.has('terms') || this.relationSet.has('tags'),
      includeTerms: this.relationSet.has('terms'),
    });
  }

  /**
   * Resolves one custom relation using its registered configuration.
   */
  private async resolveCustomRelation<T>(
    config: CustomRelationConfig<T>,
    post: TContent,
  ): Promise<T | null> {
    const embeddedData = extractEmbeddedData<unknown>(post, config.embeddedKey);

    if (embeddedData !== undefined) {
      const extracted = config.extractEmbedded(embeddedData);

      if (extracted !== null) {
        return extracted;
      }
    }

    if (!config.fallbackResolver) {
      return null;
    }

    try {
      return await config.fallbackResolver.resolve(this.client, post);
    } catch {
      return null;
    }
  }

  /**
   * Collects all requested custom relation configs for the current query.
   */
  private getRequestedCustomRelations(): Array<{ name: string; config: CustomRelationConfig<unknown> }> {
    const relations: Array<{ name: string; config: CustomRelationConfig<unknown> }> = [];

    for (const relationName of this.relationSet) {
      if (BUILT_IN_RELATION_NAMES.has(relationName as PostRelation)) {
        continue;
      }

      const config = customRelationRegistry.get(relationName);

      if (config) {
        relations.push({ name: relationName, config });
      }
    }

    return relations;
  }

  /**
   * Resolves all requested custom relations for one post.
   */
  private async resolveCustomRelations(post: TContent): Promise<Record<string, unknown>> {
    const requestedRelations = this.getRequestedCustomRelations();

    if (requestedRelations.length === 0) {
      return {};
    }

    const resolvedEntries = await Promise.all(
      requestedRelations.map(async ({ name, config }) => [
        name,
        await this.resolveCustomRelation(config, post),
      ] as const),
    );

    return Object.fromEntries(resolvedEntries);
  }

  /**
   * Resolves every requested relation and returns the related payload map.
   */
  private async resolveRelated(post: TContent): Promise<Record<string, unknown>> {
    const related: Record<string, unknown> = {};
    const requestedTerms = this.relationSet.has('terms');

    const tasks: Array<Promise<void>> = [
      this.resolveCustomRelations(post).then((customRelations) => {
        Object.assign(related, customRelations);
      }),
    ];

    if (this.relationSet.has('author')) {
      tasks.push(
        this.resolveAuthorRelation(post).then((author) => {
          related.author = author;
        }),
      );
    }

    if (this.relationSet.has('featuredMedia')) {
      tasks.push(
        this.resolveFeaturedMediaRelation(post).then((featuredMedia) => {
          related.featuredMedia = featuredMedia;
        }),
      );
    }

    if (requestedTerms || this.relationSet.has('categories') || this.relationSet.has('tags')) {
      tasks.push(
        this.resolveRequestedTerms(post).then((terms) => {
          if (this.relationSet.has('categories')) {
            related.categories = terms.categories;
          }

          if (this.relationSet.has('tags')) {
            related.tags = terms.tags;
          }

          if (requestedTerms) {
            related.terms = terms;
          }
        }),
      );
    }

    await Promise.all(tasks);

    return related;
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
    const post = await this.loadSelectedPost();
    const related = await this.resolveRelated(post);

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
    const fields = new Set<string>();

    for (const relation of this.relationSet) {
      if (relation in BUILT_IN_RELATION_FIELDS) {
        for (const field of BUILT_IN_RELATION_FIELDS[relation as PostRelation]) {
          fields.add(field);
        }
      }

      const customConfig = customRelationRegistry.get(relation);

      if (customConfig?.requiredFields) {
        for (const field of customConfig.requiredFields) {
          fields.add(field);
        }
      }
    }

    return Array.from(fields);
  }
}

export type {
  EmbeddedDataExtractor,
  RelationFallbackResolver,
  CustomRelationConfig,
  IdCollectionRelationOptions,
  IdSingleRelationOptions,
  LinkedEmbeddedCollectionRelationOptions,
  LinkedEmbeddedSingleRelationOptions,
  PostRelationClient,
  RelatedContentReference,
  RelatedPostReference,
  RelatedTermReference,
} from './relation-contracts.js';

export {
  CustomRelationRegistry,
  customRelationRegistry,
  createArrayExtractor,
  createSingleExtractor,
  defaultParseReferenceId,
  extractEmbeddedData,
  getEmbeddedRelationItems,
  getLinkedRelationIds,
  toRelatedContentReference,
  toRelatedPostReference,
  toRelatedTermReference,
  defaultParseLinkId,
  resolveContentReference,
  resolveContentReferences,
  resolvePostReference,
  resolvePostReferences,
  resolveTermReference,
  resolveTermReferences,
} from './relation-contracts.js';

export {
  createIdCollectionRelation,
  createIdSingleRelation,
  createLinkedEmbeddedCollectionRelation,
  createLinkedEmbeddedSingleRelation,
} from './relation-definitions.js';
