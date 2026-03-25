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
  parseWordPressBlocks,
  type WordPressBlockParser,
  type WordPressParsedBlock,
} from '../blocks.js';
import { ExecutableQuery } from '../core/query-base.js';
import {
  resolveWordPressRawContent,
  type WordPressGetBlocksOptions,
  type WordPressRawContentResult,
} from '../content-query.js';
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
import { ItemRelationResolver } from './item-relation-resolver.js';

/**
 * Supported relation names for fluent post hydration (built-in).
 */
export type PostRelation = 'author' | 'categories' | 'tags' | 'terms' | 'featuredMedia' | 'parent';

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
  parent: WordPressPostLike | null;
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
  'parent',
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
  parent: ['parent'],
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
 * Resolves to the base DTO when no relations are selected, and adds a
 * `related` payload only when the fluent query requests relations.
 */
export type ContentItemResult<
  TContent extends WordPressPostLike,
  TRelations extends readonly AllPostRelations[],
> = [TRelations[number]] extends [never]
  ? TContent
  : TContent & { related: SelectedPostRelations<TRelations> };

interface PostRelationLoadOptions {
  embed?: boolean;
}

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
 * Extracts parent from an _embedded up array.
 */
const extractEmbeddedParent = createSingleExtractor(
  (item: unknown) => item as WordPressPostLike,
);

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
    return this.client.terms<WordPressCategory>('categories').list({ include: ids }).catch(() => []);
  }

  /**
   * Fetches tags through the client fallback API.
   */
  private async fetchTags(ids: number[]): Promise<WordPressTag[]> {
    return this.client.terms<WordPressTag>('tags').list({ include: ids }).catch(() => []);
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
 *   .content('posts')
 *   .item('my-post')
 *   .with('author', 'categories');
 * 
 * // Custom relations (e.g., ACF)
 * const post = await client
 *   .content('posts')
 *   .item('my-post')
 *   .with('linkedArticles', 'primaryArticle');
 * ```
 */
export class PostRelationQueryBuilder<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressPostLike = WordPressPost,
> extends ExecutableQuery<ContentItemResult<TContent, TRelations>> {
  private readonly relationSet: Set<AllPostRelations>;
  private readonly getEditById?: (id: number) => PromiseLike<TContent>;
  private readonly getEditBySlug?: (slug: string) => PromiseLike<TContent | undefined>;
  private readonly missingRawMessage: string;
  private readonly defaultBlockParser?: WordPressBlockParser;
  private readonly userRequestedEmbed: boolean;
  private viewPromise: Promise<TContent> | undefined;
  private editPromise: Promise<TContent | undefined> | undefined;
  private resultPromise: Promise<ContentItemResult<TContent, TRelations>> | undefined;

  constructor(
    private readonly client: PostRelationClient,
    private readonly selector: { id?: number; slug?: string },
    private readonly getById: (id: number, options?: PostRelationLoadOptions) => PromiseLike<TContent>,
    private readonly getBySlug: (slug: string, options?: PostRelationLoadOptions) => PromiseLike<TContent | undefined>,
    relations: readonly AllPostRelations[] = [],
    private readonly finalizeContent?: (content: TContent) => PromiseLike<TContent>,
    options: {
      getEditById?: (id: number) => PromiseLike<TContent>;
      getEditBySlug?: (slug: string) => PromiseLike<TContent | undefined>;
      missingRawMessage?: string;
      defaultBlockParser?: WordPressBlockParser;
      userRequestedEmbed?: boolean;
    } = {},
  ) {
    super();
    this.relationSet = new Set(relations);
    this.getEditById = options.getEditById;
    this.getEditBySlug = options.getEditBySlug;
    this.missingRawMessage = options.missingRawMessage
      ?? 'Raw post content is unavailable. The current credentials may not have edit capabilities for this content item.';
    this.defaultBlockParser = options.defaultBlockParser;
    this.userRequestedEmbed = options.userRequestedEmbed ?? false;
  }

  /**
   * Loads the selected post by ID or slug.
   */
  private async loadSelectedPostOnce(): Promise<TContent> {
    let post: TContent | undefined;
    const shouldEmbedContent = this.relationSet.size > 0;

    if (typeof this.selector.id === 'number') {
      post = await this.getById(this.selector.id, { embed: shouldEmbedContent });
    }

    if (!post && typeof this.selector.slug === 'string') {
      post = await this.getBySlug(this.selector.slug, { embed: shouldEmbedContent });
    }

    if (!post) {
      return undefined as unknown as TContent;
    }

    return post;
  }

  /**
   * Loads and memoizes the selected view-context item.
   */
  private async loadSelectedPost(): Promise<TContent> {
    if (!this.viewPromise) {
      this.viewPromise = this.loadSelectedPostOnce();
    }

    return this.viewPromise;
  }

  /**
   * Loads the selected item in edit context when raw content helpers need it.
   */
  private async loadEditablePostOnce(): Promise<TContent | undefined> {
    if (typeof this.selector.id === 'number' && this.getEditById) {
      return this.getEditById(this.selector.id);
    }

    if (typeof this.selector.slug === 'string' && this.getEditBySlug) {
      return this.getEditBySlug(this.selector.slug);
    }

    return undefined;
  }

  /**
   * Loads and memoizes the selected edit-context item.
   */
  private async loadEditablePost(): Promise<TContent | undefined> {
    if (!this.editPromise) {
      this.editPromise = this.loadEditablePostOnce();
    }

    return this.editPromise;
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
   * Resolves the built-in parent relation for one post.
   * WordPress exposes parent through _links['up'] and _embedded['up'].
   */
  private async resolveParentRelation(post: TContent): Promise<WordPressPostLike | null> {
    // First, check if parent data is embedded (WordPress uses 'up' for parent)
    const embeddedParent = extractEmbeddedParent(extractEmbeddedData(post, 'up'));
    if (embeddedParent) {
      return embeddedParent;
    }

    // Fall back to fetching by parent ID
    const parentId = (post as unknown as { parent?: number }).parent;
    if (typeof parentId === 'number' && parentId > 0) {
      // Try to determine the resource type from the post
      const postType = (post as unknown as { type?: string }).type ?? 'page';
      try {
        const parent = await this.client.content(postType).item(parentId);
        return parent ?? null;
      } catch {
        return null;
      }
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

    if (this.relationSet.has('parent')) {
      tasks.push(
        this.resolveParentRelation(post).then((parent) => {
          related.parent = parent;
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
   * Supports built-in relations: 'author', 'categories', 'tags', 'terms', 'featuredMedia', 'parent'
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
      this.finalizeContent,
      {
        getEditById: this.getEditById,
        getEditBySlug: this.getEditBySlug,
        missingRawMessage: this.missingRawMessage,
        defaultBlockParser: this.defaultBlockParser,
        userRequestedEmbed: this.userRequestedEmbed,
      },
    ) as PostRelationQueryBuilder<[...TRelations, ...TNext], TContent>;
  }

  /**
   * Resolves raw and rendered content from one edit-context request.
   */
  async getContent(): Promise<WordPressRawContentResult | undefined> {
    const post = await this.loadEditablePost();

    if (!post) {
      return undefined;
    }

    return resolveWordPressRawContent(post, this.missingRawMessage);
  }

  /**
   * Parses raw content into Gutenberg blocks from one edit-context request.
   */
  async getBlocks(options: WordPressGetBlocksOptions = {}): Promise<WordPressParsedBlock[] | undefined> {
    const content = await this.getContent();

    if (!content) {
      return undefined;
    }

    return parseWordPressBlocks(content.raw, options.parser ?? this.defaultBlockParser);
  }

  /**
   * Resolves and memoizes the final fluent query result.
   */
  protected async resolveResult(): Promise<ContentItemResult<TContent, TRelations>> {
    const post = await this.loadSelectedPost();
    
    // Return undefined early if post not found
    if (!post) {
      return undefined as unknown as ContentItemResult<TContent, TRelations>;
    }
    
    const related = await this.resolveRelated(post);
    const content = this.finalizeContent
      ? await this.finalizeContent(post)
      : post;

    if (this.relationSet.size === 0) {
      return content as ContentItemResult<TContent, TRelations>;
    }

    // Strip _embedded from response unless user explicitly requested it
    if (this.userRequestedEmbed) {
      return {
        ...content,
        related: related as SelectedPostRelations<TRelations>,
      } as ContentItemResult<TContent, TRelations>;
    }

    const contentRecord = content as Record<string, unknown>;
    const { _embedded, ...contentWithoutEmbedded } = contentRecord;

    return {
      ...(contentWithoutEmbedded as TContent),
      related: related as SelectedPostRelations<TRelations>,
    } as ContentItemResult<TContent, TRelations>;
  }

  /**
   * Gets the list of required fields for the current relations.
   * Useful for ensuring fields aren't excluded when using _fields filter.
   */
  getRequiredFields(): string[] {
    const fields = new Set<string>();

    for (const relation of this.relationSet) {
      if (Object.hasOwn(BUILT_IN_RELATION_FIELDS, relation)) {
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

  /**
   * Resolves the standard resource payload for Promise-like usage.
   * Memoizes the result to avoid recomputing on repeated awaits.
   */
  protected execute(): Promise<ContentItemResult<TContent, TRelations>> {
    if (!this.resultPromise) {
      this.resultPromise = this.resolveResult();
    }
    return this.resultPromise;
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
