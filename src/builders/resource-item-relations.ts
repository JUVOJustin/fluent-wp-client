import { ExecutableQuery } from '../core/query-base.js';
import {
  customRelationRegistry,
  extractEmbeddedData,
  type CustomRelationConfig,
  type PostRelationClient,
  type WordPressRelationSource,
} from './relation-contracts.js';

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
 * Builds the selected relation result type for generic item relation calls.
 */
export type SelectedItemRelations<
  TRelations extends readonly string[],
  TRelationMap extends Record<string, unknown>,
> = [TRelations[number]] extends [never]
  ? {}
  : Simplify<
      UnionToIntersection<
        TRelations[number] extends infer K
          ? K extends keyof TRelationMap
            ? { [P in K]: TRelationMap[P] }
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
export type ResourceItemResult<
  TItem,
  TRelations extends readonly string[],
  TRelationMap extends Record<string, unknown>,
> = [TRelations[number]] extends [never]
  ? TItem
  : TItem & { related: SelectedItemRelations<TRelations, TRelationMap> };

/**
 * Immutable fluent item query for non-post resources with optional relation hydration.
 */
export class ResourceItemQueryBuilder<
  TItem extends WordPressRelationSource,
  TRelationMap extends Record<string, unknown>,
  TAllRelations extends string,
  TRelations extends readonly TAllRelations[] = [],
> extends ExecutableQuery<ResourceItemResult<TItem, TRelations, TRelationMap> | undefined> {
  private resultPromise: Promise<ResourceItemResult<TItem, TRelations, TRelationMap> | undefined> | undefined;
  private readonly relationSet: Set<TAllRelations>;

  constructor(
    private readonly client: PostRelationClient,
    private readonly loadItem: () => Promise<TItem | undefined>,
    private readonly builtInRelations: Set<TAllRelations>,
    private readonly resolveBuiltInRelations: (
      item: TItem,
      relationSet: Set<TAllRelations>,
    ) => Promise<Record<string, unknown>>,
    relations: readonly TAllRelations[] = [],
  ) {
    super();
    this.relationSet = new Set(relations);
  }

  /**
   * Adds relation names to the hydration plan.
   */
  with<TNext extends readonly TAllRelations[]>(
    ...relations: TNext
  ): ResourceItemQueryBuilder<TItem, TRelationMap, TAllRelations, [...TRelations, ...TNext]> {
    const nextRelations = new Set(this.relationSet);

    for (const relation of relations) {
      nextRelations.add(relation);
    }

    return new ResourceItemQueryBuilder(
      this.client,
      this.loadItem,
      this.builtInRelations,
      this.resolveBuiltInRelations,
      Array.from(nextRelations),
    ) as ResourceItemQueryBuilder<TItem, TRelationMap, TAllRelations, [...TRelations, ...TNext]>;
  }

  /**
   * Resolves one custom relation using its registered configuration.
   */
  private async resolveCustomRelation<T>(
    config: CustomRelationConfig<T, TItem>,
    item: TItem,
  ): Promise<T | null> {
    const embeddedData = extractEmbeddedData<unknown>(item, config.embeddedKey);

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
      return await config.fallbackResolver.resolve(this.client, item);
    } catch {
      return null;
    }
  }

  /**
   * Resolves every requested custom relation for one item.
   */
  private async resolveCustomRelations(item: TItem): Promise<Record<string, unknown>> {
    const requestedRelations: Array<{ name: string; config: CustomRelationConfig<unknown, TItem> }> = [];

    for (const relationName of this.relationSet) {
      if (this.builtInRelations.has(relationName)) {
        continue;
      }

      const config = customRelationRegistry.get<unknown, TItem>(relationName);

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
        await this.resolveCustomRelation(config, item),
      ] as const),
    );

    return Object.fromEntries(resolvedEntries);
  }

  /**
   * Loads the item and hydrates selected built-in and custom relations.
   */
  protected execute(): Promise<ResourceItemResult<TItem, TRelations, TRelationMap> | undefined> {
    if (!this.resultPromise) {
      this.resultPromise = this.loadItem().then(async (item) => {
        if (!item || this.relationSet.size === 0) {
          return item as ResourceItemResult<TItem, TRelations, TRelationMap> | undefined;
        }

        const [builtInRelations, customRelations] = await Promise.all([
          this.resolveBuiltInRelations(item, this.relationSet),
          this.resolveCustomRelations(item),
        ]);

        return {
          ...item,
          related: {
            ...builtInRelations,
            ...customRelations,
          },
        } as ResourceItemResult<TItem, TRelations, TRelationMap>;
      });
    }

    return this.resultPromise;
  }
}
