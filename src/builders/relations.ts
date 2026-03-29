import {
  type WordPressCategory,
  type WordPressMedia,
  type WordPressPost,
  type WordPressPostLike,
  type WordPressTag,
} from '../schemas.js';
import type { WordPressAuthor } from '../schemas.js';
import { ExecutableQuery } from '../core/query-base.js';
import {
  resolveWordPressRawContent,
  type WordPressRawContentResult,
} from '../content-query.js';
import type {
  PostRelationClient,
  RelatedTermReference,
} from './relation-contracts.js';
import {
  ItemRelationResolver,
  getRelationRequiredFields,
} from './item-relation-resolver.js';

/**
 * Re-export canonical relation type definitions from the single source of truth.
 */
export type { PostRelation, AllPostRelations } from './item-relation-resolver.js';
import type { AllPostRelations } from './item-relation-resolver.js';
type PostRelation = import('./item-relation-resolver.js').PostRelation;

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
> extends ExecutableQuery<ContentItemResult<TContent, TRelations> | undefined> {
  private readonly relationSet: Set<AllPostRelations>;
  private readonly getEditById?: (id: number, fields?: string[]) => PromiseLike<TContent>;
  private readonly getEditBySlug?: (slug: string, fields?: string[]) => PromiseLike<TContent | undefined>;
  private readonly missingRawMessage: string;
  private readonly userRequestedEmbed: boolean;
  private viewPromise: Promise<TContent | undefined> | undefined;
  private editPromise: Promise<TContent | undefined> | undefined;
  private resultPromise: Promise<ContentItemResult<TContent, TRelations> | undefined> | undefined;

  constructor(
    private readonly client: PostRelationClient,
    private readonly selector: { id?: number; slug?: string },
    private readonly getById: (id: number, options?: PostRelationLoadOptions) => PromiseLike<TContent>,
    private readonly getBySlug: (slug: string, options?: PostRelationLoadOptions) => PromiseLike<TContent | undefined>,
    relations: readonly AllPostRelations[] = [],
    private readonly finalizeContent?: (content: TContent) => PromiseLike<TContent>,
    options: {
      getEditById?: (id: number, fields?: string[]) => PromiseLike<TContent>;
      getEditBySlug?: (slug: string, fields?: string[]) => PromiseLike<TContent | undefined>;
      missingRawMessage?: string;
      userRequestedEmbed?: boolean;
    } = {},
  ) {
    super();
    this.relationSet = new Set(relations);
    this.getEditById = options.getEditById;
    this.getEditBySlug = options.getEditBySlug;
    this.missingRawMessage = options.missingRawMessage
      ?? 'Raw post content is unavailable. The current credentials may not have edit capabilities for this content item.';
    this.userRequestedEmbed = options.userRequestedEmbed ?? false;
  }

  /**
   * Loads the selected post by ID or slug.
   */
  private async loadSelectedPostOnce(): Promise<TContent | undefined> {
    let post: TContent | undefined;
    const shouldEmbedContent = this.relationSet.size > 0 || this.userRequestedEmbed;

    if (typeof this.selector.id === 'number') {
      post = await this.getById(this.selector.id, { embed: shouldEmbedContent });
    }

    if (!post && typeof this.selector.slug === 'string') {
      post = await this.getBySlug(this.selector.slug, { embed: shouldEmbedContent });
    }

    return post;
  }

  /**
   * Loads and memoizes the selected view-context item.
   */
  private async loadSelectedPost(): Promise<TContent | undefined> {
    if (!this.viewPromise) {
      this.viewPromise = this.loadSelectedPostOnce();
    }

    return this.viewPromise;
  }

  /**
   * Loads the selected item in edit context when raw content helpers need it.
   * Always requests the 'id' and 'content' fields so edit-context helpers can share one lookup.
   */
  private async loadEditablePostOnce(): Promise<TContent | undefined> {
    if (typeof this.selector.id === 'number' && this.getEditById) {
      return this.getEditById(this.selector.id, ['id', 'content']);
    }

    if (typeof this.selector.slug === 'string' && this.getEditBySlug) {
      return this.getEditBySlug(this.selector.slug, ['id', 'content']);
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

    return resolveWordPressRawContent(post as WordPressPostLike, this.missingRawMessage);
  }

  /**
   * Resolves and memoizes the final fluent query result.
   */
  protected async resolveResult(): Promise<ContentItemResult<TContent, TRelations> | undefined> {
    const post = await this.loadSelectedPost();
    
    if (!post) {
      return undefined;
    }
    
    const resolver = new ItemRelationResolver(this.client, this.relationSet);
    const related = await resolver.resolveRelated(post);
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
   * Resolves the standard resource payload for Promise-like usage.
   * Memoizes the result to avoid recomputing on repeated awaits.
   */
  protected execute(): Promise<ContentItemResult<TContent, TRelations> | undefined> {
    if (!this.resultPromise) {
      this.resultPromise = this.resolveResult();
    }
    return this.resultPromise;
  }

  /**
   * Gets the list of required fields for the current relations.
   * Useful for ensuring fields aren't excluded when using _fields filter.
   */
  getRequiredFields(): string[] {
    return getRelationRequiredFields(this.relationSet);
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
