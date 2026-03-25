import { ExecutableQuery } from '../core/query-base.js';
import type {
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { WordPressPostLike } from '../schemas.js';
import type { PostRelationClient } from './relation-contracts.js';
import type { AllPostRelations } from './item-relation-resolver.js';
import { ItemRelationResolver } from './item-relation-resolver.js';
import type { ContentItemResult, SelectedPostRelations } from './relations.js';
import { RelationQueryBuilderBase, type BuildRelations } from './relation-base.js';

/**
 * Fluent builder that hydrates multiple post-like content records with selected related entities.
 * 
 * Supports both built-in relations (author, categories, tags, terms, featuredMedia)
 * and custom relations registered via `customRelationRegistry`.
 * 
 * @example
 * ```typescript
 * // Built-in relations for list
 * const posts = await client
 *   .content('posts')
 *   .list({ perPage: 10 })
 *   .with('author', 'categories');
 * 
 * // Custom relations (e.g., ACF) for list
 * const posts = await client
 *   .content('posts')
 *   .list({ perPage: 10 })
 *   .with('linkedArticles', 'primaryArticle');
 * ```
 */
export class ListRelationQueryBuilder<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressPostLike = WordPressPostLike,
> extends RelationQueryBuilderBase<TRelations, TContent, Array<ContentItemResult<TContent, TRelations>>> {
  private listPromise: Promise<TContent[]> | undefined;

  constructor(
    client: PostRelationClient,
    private readonly filter: QueryParams & PaginationParams,
    private readonly fetchList: (
      filter: QueryParams & PaginationParams,
      options?: WordPressRequestOverrides,
    ) => Promise<TContent[]>,
    private readonly requestOptions: WordPressRequestOverrides | undefined,
    relations: readonly AllPostRelations[] = [],
  ) {
    super(client, relations);
  }

  /**
   * Adds relation names to the hydration plan.
   * 
   * Supports built-in relations: 'author', 'categories', 'tags', 'terms', 'featuredMedia'
   * Also supports custom relations registered via `customRelationRegistry`.
   */
  with<TNext extends readonly AllPostRelations[]>(
    ...relations: TNext
  ): ListRelationQueryBuilder<BuildRelations<TRelations, TNext>, TContent> {
    const nextRelations = new Set(this.relationSet);

    for (const relation of relations) {
      nextRelations.add(relation);
    }

    return new ListRelationQueryBuilder(
      this.client,
      this.filter,
      this.fetchList,
      this.requestOptions,
      Array.from(nextRelations),
    );
  }

  /**
   * Loads the list with embedded data enabled if relations are requested.
   * Always requests _embed when relations are needed for hydration, but
   * strips it from the final response unless user explicitly requested embed: true.
   */
  private async loadListOnce(): Promise<TContent[]> {
    const needsEmbedForHydration = this.relationSet.size > 0;
    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;
    
    // Always request _embed if we need it for relation hydration
    const shouldRequestEmbed = needsEmbedForHydration || userRequestedEmbed;
    
    // When forcing _embed for relation hydration, override any explicit embed: false
    // by also setting embed: true so resolveEmbedQueryParams doesn't strip _embed
    const filterWithEmbed = shouldRequestEmbed
      ? { ...this.filter, embed: true, _embed: 'true' as const }
      : this.filter;

    return this.fetchList(filterWithEmbed, this.requestOptions);
  }

  /**
   * Loads and memoizes the list.
   */
  private async loadList(): Promise<TContent[]> {
    if (!this.listPromise) {
      this.listPromise = this.loadListOnce();
    }

    return this.listPromise;
  }

  /**
   * Resolves relations for a single item using the shared resolver.
   */
  private async resolveItemRelations(
    item: TContent,
    resolver: ItemRelationResolver,
  ): Promise<Record<string, unknown>> {
    return resolver.resolveRelated(item);
  }

  /**
   * Resolves and memoizes the final fluent query result.
   * Implementation of abstract method from RelationQueryBuilderBase.
   */
  protected async resolveResult(): Promise<Array<ContentItemResult<TContent, TRelations>>> {
    const items = await this.loadList();

    if (this.relationSet.size === 0) {
      return items as Array<ContentItemResult<TContent, TRelations>>;
    }

    // Create a shared resolver for all items
    const resolver = new ItemRelationResolver(this.client, this.relationSet);

    // Check if user explicitly requested embed: true
    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;

    // Resolve relations for all items in parallel
    const results = await Promise.all(
      items.map(async (item) => {
        const related = await this.resolveItemRelations(item, resolver);
        
        // Strip _embedded from response unless user explicitly requested it
        const { _embedded, ...itemWithoutEmbedded } = item as Record<string, unknown>;
        const cleanedItem = userRequestedEmbed ? item : (itemWithoutEmbedded as TContent);
        
        return {
          ...cleanedItem,
          related: related as SelectedPostRelations<TRelations>,
        } as ContentItemResult<TContent, TRelations>;
      }),
    );

    return results;
  }
}

/**
 * Fluent builder for paginated list results with relation hydration.
 */
export class PaginatedListRelationQueryBuilder<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressPostLike = WordPressPostLike,
> extends RelationQueryBuilderBase<TRelations, TContent, PaginatedResponse<ContentItemResult<TContent, TRelations>>> {
  private listPromise: Promise<PaginatedResponse<TContent>> | undefined;

  constructor(
    client: PostRelationClient,
    private readonly filter: QueryParams & PaginationParams,
    private readonly fetchPaginated: (
      filter: QueryParams & PaginationParams,
      options?: WordPressRequestOverrides,
    ) => Promise<PaginatedResponse<TContent>>,
    private readonly requestOptions: WordPressRequestOverrides | undefined,
    relations: readonly AllPostRelations[] = [],
  ) {
    super(client, relations);
  }

  /**
   * Adds relation names to the hydration plan.
   */
  with<TNext extends readonly AllPostRelations[]>(
    ...relations: TNext
  ): PaginatedListRelationQueryBuilder<BuildRelations<TRelations, TNext>, TContent> {
    const nextRelations = new Set(this.relationSet);

    for (const relation of relations) {
      nextRelations.add(relation);
    }

    return new PaginatedListRelationQueryBuilder(
      this.client,
      this.filter,
      this.fetchPaginated,
      this.requestOptions,
      Array.from(nextRelations),
    );
  }

  /**
   * Loads the paginated list with embedded data enabled if relations are requested.
   * Always requests _embed when relations are needed for hydration.
   */
  private async loadPaginatedOnce(): Promise<PaginatedResponse<TContent>> {
    const needsEmbedForHydration = this.relationSet.size > 0;
    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;
    
    // Always request _embed if we need it for relation hydration
    const shouldRequestEmbed = needsEmbedForHydration || userRequestedEmbed;
    
    // When forcing _embed for relation hydration, override any explicit embed: false
    // by also setting embed: true so resolveEmbedQueryParams doesn't strip _embed
    const filterWithEmbed = shouldRequestEmbed
      ? { ...this.filter, embed: true, _embed: 'true' as const }
      : this.filter;

    return this.fetchPaginated(filterWithEmbed, this.requestOptions);
  }

  /**
   * Loads and memoizes the paginated list.
   */
  private async loadPaginated(): Promise<PaginatedResponse<TContent>> {
    if (!this.listPromise) {
      this.listPromise = this.loadPaginatedOnce();
    }

    return this.listPromise;
  }

  /**
   * Resolves and memoizes the final fluent query result.
   * Implementation of abstract method from RelationQueryBuilderBase.
   */
  protected async resolveResult(): Promise<PaginatedResponse<ContentItemResult<TContent, TRelations>>> {
    const result = await this.loadPaginated();

    if (this.relationSet.size === 0) {
      return result as PaginatedResponse<ContentItemResult<TContent, TRelations>>;
    }

    const resolver = new ItemRelationResolver(this.client, this.relationSet);

    // Check if user explicitly requested embed: true
    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;

    const hydratedData = await Promise.all(
      result.data.map(async (item) => {
        const related = await resolver.resolveRelated(item);
        
        // Strip _embedded from response unless user explicitly requested it
        const { _embedded, ...itemWithoutEmbedded } = item as Record<string, unknown>;
        const cleanedItem = userRequestedEmbed ? item : (itemWithoutEmbedded as TContent);
        
        return {
          ...cleanedItem,
          related: related as SelectedPostRelations<TRelations>,
        } as ContentItemResult<TContent, TRelations>;
      }),
    );

    return {
      ...result,
      data: hydratedData,
    };
  }
}

/**
 * Fluent builder for listing all items (auto-pagination) with relation hydration.
 */
export class ListAllRelationQueryBuilder<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressPostLike = WordPressPostLike,
> extends RelationQueryBuilderBase<TRelations, TContent, Array<ContentItemResult<TContent, TRelations>>> {
  private listPromise: Promise<TContent[]> | undefined;

  constructor(
    client: PostRelationClient,
    private readonly filter: Omit<QueryParams & PaginationParams, 'page'>,
    private readonly fetchListAll: (
      filter: Omit<QueryParams & PaginationParams, 'page'>,
      options?: WordPressRequestOverrides,
    ) => Promise<TContent[]>,
    private readonly requestOptions: WordPressRequestOverrides | undefined,
    relations: readonly AllPostRelations[] = [],
  ) {
    super(client, relations);
  }

  /**
   * Adds relation names to the hydration plan.
   */
  with<TNext extends readonly AllPostRelations[]>(
    ...relations: TNext
  ): ListAllRelationQueryBuilder<BuildRelations<TRelations, TNext>, TContent> {
    const nextRelations = new Set(this.relationSet);

    for (const relation of relations) {
      nextRelations.add(relation);
    }

    return new ListAllRelationQueryBuilder(
      this.client,
      this.filter,
      this.fetchListAll,
      this.requestOptions,
      Array.from(nextRelations),
    );
  }

  /**
   * Loads all items with embedded data enabled if relations are requested.
   * Always requests _embed when relations are needed for hydration.
   */
  private async loadListAllOnce(): Promise<TContent[]> {
    const needsEmbedForHydration = this.relationSet.size > 0;
    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;
    
    // Always request _embed if we need it for relation hydration
    const shouldRequestEmbed = needsEmbedForHydration || userRequestedEmbed;
    
    // When forcing _embed for relation hydration, override any explicit embed: false
    // by also setting embed: true so resolveEmbedQueryParams doesn't strip _embed
    const filterWithEmbed = shouldRequestEmbed
      ? { ...this.filter, embed: true, _embed: 'true' as const }
      : this.filter;

    return this.fetchListAll(filterWithEmbed, this.requestOptions);
  }

  /**
   * Loads and memoizes the full list.
   */
  private async loadListAll(): Promise<TContent[]> {
    if (!this.listPromise) {
      this.listPromise = this.loadListAllOnce();
    }

    return this.listPromise;
  }

  /**
   * Resolves and memoizes the final fluent query result.
   * Implementation of abstract method from RelationQueryBuilderBase.
   */
  protected async resolveResult(): Promise<Array<ContentItemResult<TContent, TRelations>>> {
    const items = await this.loadListAll();

    if (this.relationSet.size === 0) {
      return items as Array<ContentItemResult<TContent, TRelations>>;
    }

    const resolver = new ItemRelationResolver(this.client, this.relationSet);

    // Check if user explicitly requested embed: true
    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;

    const results = await Promise.all(
      items.map(async (item) => {
        const related = await resolver.resolveRelated(item);
        
        // Strip _embedded from response unless user explicitly requested it
        const { _embedded, ...itemWithoutEmbedded } = item as Record<string, unknown>;
        const cleanedItem = userRequestedEmbed ? item : (itemWithoutEmbedded as TContent);
        
        return {
          ...cleanedItem,
          related: related as SelectedPostRelations<TRelations>,
        } as ContentItemResult<TContent, TRelations>;
      }),
    );

    return results;
  }
}
