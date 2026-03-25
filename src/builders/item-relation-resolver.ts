import {
  type WordPressAuthor,
  type WordPressCategory,
  type WordPressMedia,
  type WordPressPostLike,
  type WordPressTag,
  embeddedMediaSchema,
} from '../schemas.js';
import {
  customRelationRegistry,
  extractEmbeddedData,
  createSingleExtractor,
  type CustomRelationConfig,
  type PostRelationClient,
} from './relation-contracts.js';
import {
  PostTermRelationsResolver,
  type ResolvedTermRelations,
} from './post-term-relations.js';

/**
 * Supported relation names for fluent post hydration (built-in).
 */
export type PostRelation = 'author' | 'categories' | 'tags' | 'terms' | 'featuredMedia' | 'parent';

/**
 * All available relations including built-in and custom registered ones.
 */
export { customRelationRegistry } from './relation-contracts.js';

export type AllPostRelations = PostRelation | string;

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
 * Resolves relations for a single content item using embedded-first strategy.
 * Falls back to individual API calls when embedded data is unavailable.
 */
export class ItemRelationResolver {
  constructor(
    private readonly client: PostRelationClient,
    private readonly relationSet: Set<AllPostRelations>,
  ) {}

  /**
   * Checks if any relations are requested.
   */
  hasRelations(): boolean {
    return this.relationSet.size > 0;
  }

  /**
   * Gets the list of required fields for the current relations.
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
   * Resolves one author by preferring direct lookup and then list fallback.
   */
  private async fetchAuthorById(authorId: number): Promise<WordPressAuthor | null> {
    const usersClient = this.client.users();
    let direct: WordPressAuthor | null = null;

    try {
      direct = await usersClient.item(authorId) ?? null;
    } catch {
      direct = null;
    }

    if (direct) {
      return direct;
    }

    const users = await usersClient.list({ include: [authorId], perPage: 1 }).catch(() => []);
    return users[0] ?? null;
  }

  /**
   * Resolves the built-in author relation for one post.
   */
  private async resolveAuthorRelation(post: WordPressPostLike): Promise<WordPressAuthor | null> {
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
  private async resolveFeaturedMediaRelation(post: WordPressPostLike): Promise<WordPressMedia | null> {
    const embeddedMedia = extractEmbeddedFeaturedMedia(extractEmbeddedData(post, 'wp:featuredmedia'));
    const featuredMediaId = post.featured_media;

    if (embeddedMedia) {
      return embeddedMedia;
    }

    if (typeof featuredMediaId === 'number' && featuredMediaId > 0) {
      try {
        return await this.client.media().item(featuredMediaId) ?? null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Resolves the built-in parent relation for one post.
   * WordPress exposes parent through _links['up'] and _embedded['up'].
   */
  private async resolveParentRelation(post: WordPressPostLike): Promise<WordPressPostLike | null> {
    // First, check if parent data is embedded (WordPress uses 'up' for parent)
    const embeddedParent = extractEmbeddedParent(extractEmbeddedData(post, 'up'));
    if (embeddedParent) {
      return embeddedParent;
    }

    // Fall back to fetching by parent ID
    const parentId = (post as { parent?: number }).parent;
    if (typeof parentId === 'number' && parentId > 0) {
      // Try to determine the resource type from the post
      const postType = (post as { type?: string }).type ?? 'page';
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
  private async resolveRequestedTerms(post: WordPressPostLike): Promise<ResolvedTermRelations> {
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
    post: WordPressPostLike,
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
  private async resolveCustomRelations(post: WordPressPostLike): Promise<Record<string, unknown>> {
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
  async resolveRelated(post: WordPressPostLike): Promise<Record<string, unknown>> {
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
}
