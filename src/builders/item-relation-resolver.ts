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
 * Bundles the resolved built-in term relation groups for one post.
 */
interface ResolvedTermRelations {
  categories: WordPressCategory[];
  tags: WordPressTag[];
  taxonomies: Record<string, RelatedTermReference[]>;
}

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

    let taxonomies: Record<string, RelatedTermReference[]> = {};

    for (const entry of linkedResources) {
      const ids = this.getContentRelationIds(entry.taxonomy);

      if (ids.length === 0) {
        continue;
      }

      const terms = await this.client.terms<WordPressCategory>(entry.resource).list({ include: ids });

      taxonomies = this.withTaxonomy(
        taxonomies,
        entry.taxonomy,
        terms.map(toRelatedTermReference),
      );
    }

    return taxonomies;
  }

  /**
   * Resolves the requested term relation groups for one post.
   */
  async resolve(options: {
    includeCategories: boolean;
    includeTags: boolean;
    includeTerms: boolean;
  }): Promise<ResolvedTermRelations> {
    const embedded = this.getEmbeddedTerms();

    if (embedded.categories.length > 0 || embedded.tags.length > 0) {
      const linkedTaxonomies = await this.resolveLinkedTerms(embedded.taxonomies);

      return {
        categories: embedded.categories.length > 0 ? embedded.categories : [],
        tags: embedded.tags.length > 0 ? embedded.tags : [],
        taxonomies: { ...embedded.taxonomies, ...linkedTaxonomies },
      };
    }

    const [categories, tags] = await Promise.all([
      options.includeCategories ? this.fetchCategories(this.getContentRelationIds('categories')) : [],
      options.includeTags ? this.fetchTags(this.getContentRelationIds('tags')) : [],
    ]);

    return {
      categories,
      tags,
      taxonomies: {},
    };
  }
}

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
      return this.client.getMediaItem(featuredMediaId).catch(() => null);
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
