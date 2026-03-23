import type { WordPressTag } from '../schemas.js';
import type { WordPressRequestOverrides, PaginatedResponse } from '../types/resources.js';
import type { TagsFilter } from '../types/filters.js';
import type { ExtensibleFilter } from '../types/resources.js';
import type { TermWriteInput } from '../types/payloads.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import { tagSchema } from '../standard-schemas.js';
import { BaseCrudResource, type ResourceContext } from '../core/resource-base.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress tags resource with full CRUD support.
 * 
 * @example
 * ```typescript
 * const tags = TagsResource.create(runtime);
 * const allTags = await tags.getTags();
 * const tag = await tags.getTag(123);
 * ```
 */
export class TagsResource extends BaseCrudResource<
  WordPressTag,
  ExtensibleFilter<TagsFilter>,
  TermWriteInput,
  TermWriteInput
> {
  protected override get defaultSchema(): WordPressStandardSchema<WordPressTag> | undefined {
    return tagSchema as WordPressStandardSchema<WordPressTag>;
  }

  /**
   * Creates a tags resource instance.
   */
  static create(runtime: WordPressRuntime): TagsResource {
    return new TagsResource({
      runtime,
      endpoint: '/tags',
    });
  }

  /**
   * Alias for list() - gets tags matching filter.
   */
  getTags(filter?: ExtensibleFilter<TagsFilter>, options?: WordPressRequestOverrides): Promise<WordPressTag[]> {
    return this.list(filter, options);
  }

  /**
   * Alias for listAll() - gets all tags via pagination.
   */
  getAllTags(
    filter?: Omit<ExtensibleFilter<TagsFilter>, 'page'>,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressTag[]> {
    return this.listAll(filter, options);
  }

  /**
   * Alias for listPaginated() - gets tags with pagination metadata.
   */
  getTagsPaginated(
    filter?: ExtensibleFilter<TagsFilter>,
    options?: WordPressRequestOverrides,
  ): Promise<PaginatedResponse<WordPressTag>> {
    return this.listPaginated(filter, options);
  }

  /**
   * Alias for getById() - gets tag by ID.
   */
  getTag(id: number, options?: WordPressRequestOverrides): Promise<WordPressTag> {
    return this.getById(id, options);
  }

  /**
   * Alias for getBySlug() - gets tag by slug.
   */
  getTagBySlug(slug: string, options?: WordPressRequestOverrides): Promise<WordPressTag | undefined> {
    return this.getBySlug(slug, options);
  }
}

/**
 * Legacy factory function - now delegates to TagsResource.create().
 * @deprecated Use TagsResource.create() or new TagsResource() directly.
 */
export function createTagsResource(runtime: WordPressRuntime): TagsResource {
  return TagsResource.create(runtime);
}

/**
 * @deprecated Import TagMethods from '../types/resources.js' instead.
 */
export interface TagMethods extends TagsResource {}
