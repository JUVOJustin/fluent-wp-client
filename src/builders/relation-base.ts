import { ExecutableQuery } from '../core/query-base.js';
import type { WordPressPostLike } from '../schemas.js';
import type { PostRelationClient } from './relation-contracts.js';
import type { AllPostRelations } from './item-relation-resolver.js';
import { ItemRelationResolver } from './item-relation-resolver.js';

/**
 * Abstract base class for relation query builders (single item and collections).
 * 
 * Provides shared functionality:
 * - Relation set management
 * - with() method pattern
 * - getRequiredFields() using ItemRelationResolver
 * - execute() delegation for Promise-like behavior
 * 
 * Builders extend ExecutableQuery and implement PromiseLike, so they can be
 * awaited directly without calling any explicit resolution method.
 * 
 * Subclasses must implement:
 * - resolveResult(): Promise<TResult> - the actual data fetching and hydration
 */
export abstract class RelationQueryBuilderBase<
  TRelations extends readonly AllPostRelations[] = [],
  TContent extends WordPressPostLike = WordPressPostLike,
  TResult = unknown,
> extends ExecutableQuery<TResult> {
  protected readonly relationSet: Set<AllPostRelations>;
  private resultPromise: Promise<TResult> | undefined;

  constructor(
    protected readonly client: PostRelationClient,
    relations: readonly AllPostRelations[] = [],
  ) {
    super();
    this.relationSet = new Set(relations);
  }

  /**
   * Gets the list of required fields for the current relations.
   * Useful for ensuring fields aren't excluded when using _fields filter.
   */
  getRequiredFields(): string[] {
    const resolver = new ItemRelationResolver(this.client, this.relationSet);
    return resolver.getRequiredFields();
  }

  /**
   * Abstract method to resolve the final result.
   * Must be implemented by subclasses.
   */
  protected abstract resolveResult(): Promise<TResult>;

  /**
   * Executes the query - implements ExecutableQuery requirement.
   * Memoizes the result to avoid recomputing on repeated awaits.
   */
  protected execute(): Promise<TResult> {
    if (!this.resultPromise) {
      this.resultPromise = this.resolveResult();
    }
    return this.resultPromise;
  }
}

/**
 * Type helper for building the relations array in with() methods.
 */
export type BuildRelations<
  TCurrent extends readonly AllPostRelations[],
  TNext extends readonly AllPostRelations[],
> = [...TCurrent, ...TNext];
