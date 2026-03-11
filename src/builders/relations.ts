import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPost,
  WordPressTag,
} from '../schemas.js';

/**
 * Supported relation names for fluent post hydration.
 */
export type PostRelation = 'author' | 'categories' | 'tags' | 'terms' | 'featuredMedia';

/**
 * Client surface required by the post relation hydrator.
 */
export interface PostRelationClient {
  getPost: (id: number) => PromiseLike<WordPressPost>;
  getPostBySlug: (slug: string) => PromiseLike<WordPressPost | undefined>;
  getUser: (id: number) => Promise<WordPressAuthor>;
  getUsers?: (filter?: { include?: number[]; perPage?: number }) => Promise<WordPressAuthor[]>;
  getCategories: (filter?: { include?: number[] }) => Promise<WordPressCategory[]>;
  getTags: (filter?: { include?: number[] }) => Promise<WordPressTag[]>;
  getMediaItem: (id: number) => Promise<WordPressMedia>;
}

/**
 * Helper map used to derive relation result types.
 */
interface PostRelationMap {
  author: WordPressAuthor | null;
  categories: WordPressCategory[];
  tags: WordPressTag[];
  terms: {
    categories: WordPressCategory[];
    tags: WordPressTag[];
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
 * Builds the selected relation result type for fluent relation calls.
 */
export type SelectedPostRelations<TRelations extends readonly PostRelation[]> = [TRelations[number]] extends [never]
  ? {}
  : Simplify<UnionToIntersection<
      TRelations[number] extends infer K
        ? K extends keyof PostRelationMap
          ? { [P in K]: PostRelationMap[P] }
          : never
        : never
    >>;

/**
 * Resolves embedded author data when available.
 */
function getEmbeddedAuthor(post: WordPressPost): WordPressAuthor | null {
  const embedded = (post as { _embedded?: Record<string, unknown> })._embedded;
  const authors = embedded?.author;

  if (!Array.isArray(authors) || authors.length === 0) {
    return null;
  }

  return authors[0] as WordPressAuthor;
}

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
 * Resolves embedded featured media data when available.
 */
function getEmbeddedFeaturedMedia(post: WordPressPost): WordPressMedia | null {
  const embedded = (post as { _embedded?: Record<string, unknown> })._embedded;
  const media = embedded?.['wp:featuredmedia'];

  if (!Array.isArray(media) || media.length === 0) {
    return null;
  }

  return media[0] as WordPressMedia;
}

/**
 * Resolves embedded taxonomy terms by taxonomy name.
 */
function getEmbeddedTerms(post: WordPressPost): {
  categories: WordPressCategory[];
  tags: WordPressTag[];
} {
  const embedded = (post as { _embedded?: Record<string, unknown> })._embedded;
  const termGroups = embedded?.['wp:term'];

  if (!Array.isArray(termGroups)) {
    return {
      categories: [],
      tags: [],
    };
  }

  const categories: WordPressCategory[] = [];
  const tags: WordPressTag[] = [];

  for (const group of termGroups) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const term of group as Array<Record<string, unknown>>) {
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
  };
}

/**
 * Fluent builder that hydrates one post and selected related entities.
 */
export class PostRelationQueryBuilder<TRelations extends readonly PostRelation[] = []> {
  private readonly relationSet: Set<PostRelation>;

  constructor(
    private readonly client: PostRelationClient,
    private readonly selector: { id?: number; slug?: string },
    relations: readonly PostRelation[] = [],
  ) {
    this.relationSet = new Set(relations);
  }

  /**
   * Adds relation names to the hydration plan.
   */
  with<TNext extends readonly PostRelation[]>(
    ...relations: TNext
  ): PostRelationQueryBuilder<[...TRelations, ...TNext]> {
    const nextRelations = new Set(this.relationSet);

    for (const relation of relations) {
      nextRelations.add(relation);
    }

    return new PostRelationQueryBuilder(
      this.client,
      this.selector,
      Array.from(nextRelations),
    ) as PostRelationQueryBuilder<[...TRelations, ...TNext]>;
  }

  /**
   * Fetches the selected post and resolves requested relations.
   */
  async get(): Promise<WordPressPost & { related: SelectedPostRelations<TRelations> }> {
    let post: WordPressPost | undefined;

    if (typeof this.selector.id === 'number') {
      post = await this.client.getPost(this.selector.id);
    }

    if (!post && typeof this.selector.slug === 'string') {
      post = await this.client.getPostBySlug(this.selector.slug);
    }

    if (!post) {
      throw new Error('Post not found for the provided fluent relation selector.');
    }

    const related: Record<string, unknown> = {};
    const requestedTerms = this.relationSet.has('terms');
    const requestedCategories = requestedTerms || this.relationSet.has('categories');
    const requestedTags = requestedTerms || this.relationSet.has('tags');

    if (this.relationSet.has('author')) {
      const embeddedAuthor = getEmbeddedAuthor(post);
      related.author = embeddedAuthor ?? await resolveAuthor(this.client, post.author);
    }

    if (this.relationSet.has('featuredMedia')) {
      const embeddedMedia = getEmbeddedFeaturedMedia(post);
      const featuredMediaId = post.featured_media;

      if (embeddedMedia) {
        related.featuredMedia = embeddedMedia;
      } else if (typeof featuredMediaId === 'number' && featuredMediaId > 0) {
        related.featuredMedia = await this.client.getMediaItem(featuredMediaId).catch(() => null);
      } else {
        related.featuredMedia = null;
      }
    }

    const embeddedTerms = getEmbeddedTerms(post);
    let categories = embeddedTerms.categories;
    let tags = embeddedTerms.tags;

    if (requestedCategories && categories.length === 0 && Array.isArray(post.categories) && post.categories.length > 0) {
      categories = await this.client.getCategories({ include: post.categories }).catch(() => []);
    }

    if (requestedTags && tags.length === 0 && Array.isArray(post.tags) && post.tags.length > 0) {
      tags = await this.client.getTags({ include: post.tags }).catch(() => []);
    }

    if (this.relationSet.has('categories')) {
      related.categories = categories;
    }

    if (this.relationSet.has('tags')) {
      related.tags = tags;
    }

    if (requestedTerms) {
      related.terms = { categories, tags };
    }

    return {
      ...post,
      related: related as SelectedPostRelations<TRelations>,
    };
  }
}
