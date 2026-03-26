import type {
  PaginatedResponse,
  PaginationParams,
  QueryParams,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { ListAllOptions } from '../core/pagination.js';
import type { WordPressPostLike } from '../schemas.js';
import type { PostRelationClient } from './relation-contracts.js';
import type { AllPostRelations } from './item-relation-resolver.js';
import { ItemRelationResolver } from './item-relation-resolver.js';
import type { ContentItemResult, SelectedPostRelations } from './relations.js';
import { RelationQueryBuilderBase, type BuildRelations } from './relation-base.js';

/**
 * Injects _embed into a filter when relations need embedded data for hydration.
 * Shared across all list relation builders.
 */
function applyEmbedForRelations<TFilter extends Record<string, unknown>>(
  filter: TFilter,
  hasRelations: boolean,
): TFilter {
  const userRequestedEmbed = (filter as { embed?: boolean }).embed === true;
  const shouldRequestEmbed = hasRelations || userRequestedEmbed;

  if (!shouldRequestEmbed) {
    return filter;
  }

  return { ...filter, embed: true, _embed: 'true' as const };
}

/**
 * Hydrates an array of items with resolved relations, stripping _embedded unless user-requested.
 * Shared across all list relation builders.
 */
async function hydrateItemsWithRelations<
  TContent extends WordPressPostLike,
  TRelations extends readonly AllPostRelations[],
>(
  items: TContent[],
  client: PostRelationClient,
  relationSet: Set<AllPostRelations>,
  userRequestedEmbed: boolean,
): Promise<Array<ContentItemResult<TContent, TRelations>>> {
  const resolver = new ItemRelationResolver(client, relationSet);

  return Promise.all(
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
}

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
   * Loads and memoizes the list with embed injection when relations are requested.
   */
  private async loadList(): Promise<TContent[]> {
    if (!this.listPromise) {
      const filterWithEmbed = applyEmbedForRelations(this.filter, this.relationSet.size > 0);
      this.listPromise = this.fetchList(filterWithEmbed, this.requestOptions);
    }

    return this.listPromise;
  }

  /**
   * Resolves and memoizes the final fluent query result.
   */
  protected async resolveResult(): Promise<Array<ContentItemResult<TContent, TRelations>>> {
    const items = await this.loadList();

    if (this.relationSet.size === 0) {
      return items as Array<ContentItemResult<TContent, TRelations>>;
    }

    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;

    return hydrateItemsWithRelations<TContent, TRelations>(
      items,
      this.client,
      this.relationSet,
      userRequestedEmbed,
    );
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
   * Loads and memoizes the paginated list with embed injection when relations are requested.
   */
  private async loadPaginated(): Promise<PaginatedResponse<TContent>> {
    if (!this.listPromise) {
      const filterWithEmbed = applyEmbedForRelations(this.filter, this.relationSet.size > 0);
      this.listPromise = this.fetchPaginated(filterWithEmbed, this.requestOptions);
    }

    return this.listPromise;
  }

  /**
   * Resolves and memoizes the final fluent query result.
   */
  protected async resolveResult(): Promise<PaginatedResponse<ContentItemResult<TContent, TRelations>>> {
    const result = await this.loadPaginated();

    if (this.relationSet.size === 0) {
      return result as PaginatedResponse<ContentItemResult<TContent, TRelations>>;
    }

    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;

    return {
      ...result,
      data: await hydrateItemsWithRelations<TContent, TRelations>(
        result.data,
        this.client,
        this.relationSet,
        userRequestedEmbed,
      ),
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
      listOptions?: ListAllOptions,
    ) => Promise<TContent[]>,
    private readonly requestOptions: WordPressRequestOverrides | undefined,
    relations: readonly AllPostRelations[] = [],
    private readonly listOptions?: ListAllOptions,
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
      this.listOptions,
    );
  }

  /**
   * Loads and memoizes all items with embed injection when relations are requested.
   */
  private async loadListAll(): Promise<TContent[]> {
    if (!this.listPromise) {
      const filterWithEmbed = applyEmbedForRelations(
        this.filter as Record<string, unknown>,
        this.relationSet.size > 0,
      ) as Omit<QueryParams & PaginationParams, 'page'>;
      this.listPromise = this.fetchListAll(filterWithEmbed, this.requestOptions, this.listOptions);
    }

    return this.listPromise;
  }

  /**
   * Resolves and memoizes the final fluent query result.
   */
  protected async resolveResult(): Promise<Array<ContentItemResult<TContent, TRelations>>> {
    const items = await this.loadListAll();

    if (this.relationSet.size === 0) {
      return items as Array<ContentItemResult<TContent, TRelations>>;
    }

    const userRequestedEmbed = (this.filter as { embed?: boolean }).embed === true;

    return hydrateItemsWithRelations<TContent, TRelations>(
      items,
      this.client,
      this.relationSet,
      userRequestedEmbed,
    );
  }
}
