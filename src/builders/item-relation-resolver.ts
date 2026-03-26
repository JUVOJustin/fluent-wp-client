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
  type WordPressRelationSource,
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
export const BUILT_IN_RELATION_NAMES = new Set<PostRelation>([
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
export const BUILT_IN_RELATION_FIELDS: Record<PostRelation, readonly string[]> = {
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
export const extractEmbeddedAuthor = createSingleExtractor(
  (item: unknown) => item as WordPressAuthor,
);

/**
 * Extracts featured media from an _embedded wp:featuredmedia array.
 * Validates each item against embeddedMediaSchema before returning.
 */
export const extractEmbeddedFeaturedMedia = createSingleExtractor((item: unknown) => {
  const result = embeddedMediaSchema.safeParse(item);
  return result.success ? (result.data as unknown as WordPressMedia) : null;
});

/**
 * Extracts parent from an _embedded up array.
 */
export const extractEmbeddedParent = createSingleExtractor(
  (item: unknown) => item as WordPressPostLike,
);

/**
 * Extracts the first post from an _embedded post or up array.
 * Shared by comments and media relation resolvers.
 */
export const extractEmbeddedPost = createSingleExtractor(
  (item: unknown) => item as WordPressPostLike,
);

/**
 * Resolves an author by ID using the relation client's users resource.
 * Returns null when the author ID is invalid or the request fails.
 * Shared by post, comment, and media relation resolvers.
 */
export async function resolveAuthorById(
  client: PostRelationClient,
  authorId: unknown,
): Promise<WordPressAuthor | null> {
  if (typeof authorId !== 'number' || authorId <= 0) {
    return null;
  }

  try {
    return await client.users().item(authorId) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves one custom relation using its registered configuration.
 * Shared by all relation resolvers (single-item, list, and non-post resources).
 */
export async function resolveCustomRelation<T>(
  config: CustomRelationConfig<T, WordPressRelationSource>,
  client: PostRelationClient,
  source: WordPressRelationSource,
): Promise<T | null> {
  const embeddedData = extractEmbeddedData<unknown>(source, config.embeddedKey);

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
    return await config.fallbackResolver.resolve(client, source);
  } catch {
    return null;
  }
}

/**
 * Resolves all requested custom relations for one source item.
 * Skips built-in relation names and only resolves registered custom configs.
 */
export async function resolveRequestedCustomRelations(
  relationSet: Set<string>,
  builtInNames: Set<string>,
  client: PostRelationClient,
  source: WordPressRelationSource,
): Promise<Record<string, unknown>> {
  const requestedRelations: Array<{ name: string; config: CustomRelationConfig<unknown, WordPressRelationSource> }> = [];

  for (const relationName of relationSet) {
    if (builtInNames.has(relationName)) {
      continue;
    }

    const config = customRelationRegistry.get(relationName);

    if (config) {
      requestedRelations.push({ name: relationName, config });
    }
  }

  if (requestedRelations.length === 0) {
    return {};
  }

  const resolvedEntries = await Promise.all(
    requestedRelations.map(async ({ name, config }) => [
      name,
      await resolveCustomRelation(config, client, source),
    ] as const),
  );

  return Object.fromEntries(resolvedEntries);
}

/**
 * Gets the list of required fields for a given set of relations.
 * Checks both built-in relation fields and custom relation requiredFields.
 */
export function getRelationRequiredFields(relationSet: Set<string>): string[] {
  const fields = new Set<string>();

  for (const relation of relationSet) {
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
    return getRelationRequiredFields(this.relationSet);
  }

  /**
   * Resolves the built-in author relation for one post.
   */
  private async resolveAuthorRelation(post: WordPressPostLike): Promise<WordPressAuthor | null> {
    const embeddedAuthor = extractEmbeddedAuthor(extractEmbeddedData(post, 'author'));

    if (embeddedAuthor) {
      return embeddedAuthor;
    }

    return resolveAuthorById(this.client, post.author);
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
    const embeddedParent = extractEmbeddedParent(extractEmbeddedData(post, 'up'));
    if (embeddedParent) {
      return embeddedParent;
    }

    const parentId = (post as { parent?: number }).parent;
    if (typeof parentId === 'number' && parentId > 0) {
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
   * Resolves every requested relation and returns the related payload map.
   */
  async resolveRelated(post: WordPressPostLike): Promise<Record<string, unknown>> {
    const related: Record<string, unknown> = {};
    const requestedTerms = this.relationSet.has('terms');

    const tasks: Array<Promise<void>> = [
      resolveRequestedCustomRelations(
        this.relationSet,
        BUILT_IN_RELATION_NAMES,
        this.client,
        post,
      ).then((customRelations) => {
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
