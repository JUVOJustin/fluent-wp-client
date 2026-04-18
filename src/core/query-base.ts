/**
 * Base class for query-like objects that can be awaited (thenable).
 *
 * Provides standard Promise-like methods (then, catch, finally) that delegate
 * to an abstract execute() method. Subclasses implement execute() to return
 * the actual data.
 *
 * @example
 * ```typescript
 * class MyQuery extends ExecutableQuery<string> {
 *   protected execute(): Promise<string> {
 *     return Promise.resolve('hello');
 *   }
 * }
 *
 * const result = await new MyQuery(); // 'hello'
 * ```
 */
export abstract class ExecutableQuery<TResult> implements PromiseLike<TResult> {
  /**
   * Executes the query and returns the result.
   * Must be implemented by subclasses.
   */
  protected abstract execute(): Promise<TResult>;

  /**
   * Supports direct `await` usage by delegating to execute().
   */
  then<TResult1 = TResult, TResult2 = never>(
    onfulfilled?: ((value: TResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }

  /**
   * Supports .catch() by delegating to execute().
   */
  catch<TCatchResult = never>(
    onrejected?:
      | ((reason: unknown) => TCatchResult | PromiseLike<TCatchResult>)
      | null,
  ): Promise<TResult | TCatchResult> {
    return this.execute().catch(onrejected ?? undefined) as Promise<
      TResult | TCatchResult
    >;
  }

  /**
   * Supports .finally() by delegating to execute().
   */
  finally(onfinally?: (() => void) | null): Promise<TResult> {
    return this.execute().finally(onfinally ?? undefined);
  }
}

/**
 * Base class for immutable builder patterns.
 *
 * Provides shared cloning logic. Subclasses implement clone() to return
 * a new instance with modified state. This ensures builders are immutable
 * and safe to reuse and chain.
 *
 * @example
 * ```typescript
 * class MyBuilder extends ImmutableBuilder<MyBuilderState, MyBuilder> {
 *   withValue(value: string): MyBuilder {
 *     return this.clone({ value });
 *   }
 *
 *   protected clone(partial: Partial<MyBuilderState>): MyBuilder {
 *     return new MyBuilder({ ...this.state, ...partial });
 *   }
 * }
 * ```
 */
export abstract class ImmutableBuilder<
  TState,
  TSelf extends ImmutableBuilder<TState, TSelf>,
> {
  protected constructor(protected readonly state: TState) {}

  /**
   * Creates a new builder instance with modified state.
   * Must be implemented by subclasses.
   */
  protected abstract clone(partial: Partial<TState>): TSelf;
}

/**
 * Configuration state for standard WordPress REST query builders.
 */
export interface WordPressQueryState {
  headers: Record<string, string>;
  params: Record<string, string | string[]>;
}

/**
 * Mixin-like helper to create a builder that is both immutable and executable.
 *
 * This is a factory function that returns a class definition. Use it when you
 * need a builder that has both capabilities without deep inheritance hierarchies.
 *
 * @example
 * ```typescript
 * class MyBuilder extends createExecutableBuilder<{ value: string }, string>({
 *   execute: async (state) => state.value,
 * }) {
 *   withValue(value: string) {
 *     return this.clone({ value });
 *   }
 * }
 * ```
 */
export function createExecutableBuilder<TState, TResult>(config: {
  execute: (state: TState) => Promise<TResult>;
}) {
  abstract class ExecutableBuilderBase implements PromiseLike<TResult> {
    constructor(readonly state: TState) {}

    abstract clone(partial: Partial<TState>): ExecutableBuilderBase;

    then<TResult1 = TResult, TResult2 = never>(
      onfulfilled?:
        | ((value: TResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ): Promise<TResult1 | TResult2> {
      return config
        .execute(this.state)
        .then(onfulfilled ?? undefined, onrejected ?? undefined);
    }

    catch<TCatchResult = never>(
      onrejected?:
        | ((reason: unknown) => TCatchResult | PromiseLike<TCatchResult>)
        | null,
    ): Promise<TResult | TCatchResult> {
      return config
        .execute(this.state)
        .catch(onrejected ?? undefined) as Promise<TResult | TCatchResult>;
    }

    finally(onfinally?: (() => void) | null): Promise<TResult> {
      return config.execute(this.state).finally(onfinally ?? undefined);
    }
  }

  return ExecutableBuilderBase;
}

/**
 * Type helper for extracting builder method return types.
 */
export type BuilderReturnType<T> = T extends { then: infer R } ? R : never;
