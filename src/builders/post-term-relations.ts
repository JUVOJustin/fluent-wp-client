import type {
  WordPressCategory,
  WordPressPostLike,
  WordPressTag,
} from '../schemas.js';
import {
  defaultParseReferenceId,
  extractEmbeddedData,
  toRelatedTermReference,
  type PostRelationClient,
  type RelatedTermReference,
} from './relation-contracts.js';

/**
 * Bundles the resolved built-in term relation groups for one post.
 */
export interface ResolvedTermRelations {
  categories: WordPressCategory[];
  tags: WordPressTag[];
  taxonomies: Record<string, RelatedTermReference[]>;
}

/**
 * Coordinates built-in taxonomy relation hydration for one post response.
 */
export class PostTermRelationsResolver {
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
    const linkedResources = this.getLinkedTermResources()
      .filter((entry) => !existingTaxonomies[entry.taxonomy] || existingTaxonomies[entry.taxonomy].length === 0);

    if (linkedResources.length === 0) {
      return {};
    }

    let taxonomies: Record<string, RelatedTermReference[]> = {};

    for (const entry of linkedResources) {
      const ids = this.getContentRelationIds(entry.taxonomy);

      if (!ids || ids.length === 0) {
        continue;
      }

      try {
        const terms = await this.client.terms<WordPressCategory>(entry.resource).list({ include: ids });

        taxonomies = this.withTaxonomy(
          taxonomies,
          entry.taxonomy,
          terms.map(toRelatedTermReference),
        );
      } catch {
        continue;
      }
    }

    return taxonomies;
  }

  /**
   * Resolves the requested term relation groups for the configured post.
   */
  async resolve(options: {
    includeCategories: boolean;
    includeTags: boolean;
    includeTerms: boolean;
  }): Promise<ResolvedTermRelations> {
    const embedded = this.getEmbeddedTerms();

    if (embedded.categories.length > 0 || embedded.tags.length > 0) {
      const linkedTaxonomies = options.includeTerms
        ? await this.resolveLinkedTerms(embedded.taxonomies)
        : {};

      return {
        categories: options.includeCategories && embedded.categories.length > 0
          ? embedded.categories
          : [],
        tags: options.includeTags && embedded.tags.length > 0
          ? embedded.tags
          : [],
        taxonomies: options.includeTerms
          ? { ...embedded.taxonomies, ...linkedTaxonomies }
          : {},
      };
    }

    const [categories, tags] = await Promise.all([
      options.includeCategories ? this.fetchCategories(this.getContentRelationIds('categories')) : [],
      options.includeTags ? this.fetchTags(this.getContentRelationIds('tags')) : [],
    ]);

    let baseTaxonomies: Record<string, RelatedTermReference[]> = {};
    if (categories.length > 0) {
      baseTaxonomies = this.withTaxonomy(baseTaxonomies, 'category', categories.map(toRelatedTermReference));
    }
    if (tags.length > 0) {
      baseTaxonomies = this.withTaxonomy(baseTaxonomies, 'post_tag', tags.map(toRelatedTermReference));
    }

    let taxonomies = baseTaxonomies;
    if (options.includeTerms) {
      const linkedTaxonomies = await this.resolveLinkedTerms(baseTaxonomies);
      taxonomies = { ...baseTaxonomies, ...linkedTaxonomies };
    }

    return {
      categories,
      tags,
      taxonomies,
    };
  }
}
