import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressContent,
  WordPressMedia,
  WordPressPost,
  WordPressTag,
} from '../schemas.js';
import type { QueryParams } from '../types/resources.js';

/**
 * Supported relation names for fluent post hydration.
 */
export type PostRelation = 'author' | 'categories' | 'tags' | 'terms' | 'featuredMedia';

/**
 * Shared term shape used for taxonomy maps.
 */
type WordPressTermLike = WordPressCategory | WordPressTag;

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
  getTermCollection?: <TTerm = WordPressCategory>(
    resource: string,
    filter?: QueryParams,
  ) => Promise<TTerm[]>;
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
    taxonomies: Record<string, WordPressTermLike[]>;
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
function getEmbeddedAuthor(post: WordPressContent): WordPressAuthor | null {
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
function getEmbeddedFeaturedMedia(post: WordPressContent): WordPressMedia | null {
  const embedded = (post as { _embedded?: Record<string, unknown> })._embedded;
  const media = embedded?.['wp:featuredmedia'];

  if (!Array.isArray(media) || media.length === 0) {
    return null;
  }

  return media[0] as WordPressMedia;
}

/**
 * Reads one numeric relation ID array from a content record.
 */
function getContentRelationIds(content: WordPressContent, field: string): number[] {
  const value = (content as Record<string, unknown>)[field];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((id): id is number => typeof id === 'number' && id > 0);
}

/**
 * Resolves embedded taxonomy terms by taxonomy name.
 */
function getEmbeddedTerms(post: WordPressContent): {
  categories: WordPressCategory[];
  tags: WordPressTag[];
  taxonomies: Record<string, WordPressTermLike[]>;
} {
  const embedded = (post as { _embedded?: Record<string, unknown> })._embedded;
  const termGroups = embedded?.['wp:term'];

  if (!Array.isArray(termGroups)) {
    return {
      categories: [],
      tags: [],
      taxonomies: {},
    };
  }

  const categories: WordPressCategory[] = [];
  const tags: WordPressTag[] = [];
  const taxonomies: Record<string, WordPressTermLike[]> = {};

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

      taxonomies[term.taxonomy].push(term as WordPressTermLike);

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
  existingTaxonomies: Record<string, WordPressTermLike[]>,
): Promise<Record<string, WordPressTermLike[]>> {
  if (!client.getTermCollection) {
    return {};
  }

  const linkedResources = getLinkedTermResources(post)
    .filter((entry) => !existingTaxonomies[entry.taxonomy] || existingTaxonomies[entry.taxonomy].length === 0);

  if (linkedResources.length === 0) {
    return {};
  }

  const resolved: Record<string, WordPressTermLike[]> = {};

  for (const entry of linkedResources) {
    try {
      const terms = await client.getTermCollection<WordPressCategory>(entry.resource, {
        post: post.id,
        perPage: 100,
      });
      resolved[entry.taxonomy] = terms;
    } catch {
      continue;
    }
  }

  return resolved;
}

/**
 * Fluent builder that hydrates one post-like content record and selected related entities.
 */
export class PostRelationQueryBuilder<
  TRelations extends readonly PostRelation[] = [],
  TContent extends WordPressContent = WordPressPost,
> {
  private readonly relationSet: Set<PostRelation>;

  constructor(
    private readonly client: PostRelationClient,
    private readonly selector: { id?: number; slug?: string },
    private readonly getById: (id: number) => PromiseLike<TContent>,
    private readonly getBySlug: (slug: string) => PromiseLike<TContent | undefined>,
    relations: readonly PostRelation[] = [],
  ) {
    this.relationSet = new Set(relations);
  }

  /**
   * Adds relation names to the hydration plan.
   */
  with<TNext extends readonly PostRelation[]>(
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
   * Fetches the selected post-like content item and resolves requested relations.
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
    let taxonomies = { ...embeddedTerms.taxonomies };

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
        category: categories,
      };
    }

    if (tags.length > 0) {
      taxonomies = {
        ...taxonomies,
        post_tag: tags,
      };
    }

    if (requestedTerms) {
      taxonomies = {
        ...taxonomies,
        ...await resolveLinkedTerms(this.client, post, taxonomies),
      };
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

    return {
      ...post,
      related: related as SelectedPostRelations<TRelations>,
    };
  }
}
