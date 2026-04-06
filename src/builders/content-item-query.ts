import type { WordPressPost, WordPressPostLike } from '../schemas.js';
import { ExecutableQuery } from '../core/query-base.js';
import {
  resolveWordPressRawContent,
  type WordPressRawContentResult,
} from '../content-query.js';

/**
 * Options controlling how one content item is loaded.
 */
interface ContentItemLoadOptions {
  embed?: boolean | string[];
}

/**
 * Awaitable single-item query for post-like content.
 *
 * Returned by `content(resource).item(idOrSlug)`. Supports direct `await`
 * and exposes `.getContent()` for raw Gutenberg markup (edit context).
 *
 * @example
 * ```ts
 * // Simple fetch
 * const post = await wp.content('posts').item(123);
 *
 * // With all embedded relations
 * const post = await wp.content('posts').item(123, { embed: true });
 *
 * // With selective embed
 * const post = await wp.content('posts').item(123, { embed: ['author', 'wp:term'] });
 *
 * // Raw content for block parsing
 * const raw = await wp.content('posts').item(123).getContent();
 * ```
 */
export class ContentItemQuery<
  TContent extends WordPressPostLike = WordPressPost,
> extends ExecutableQuery<TContent | undefined> {
  private readonly missingRawMessage: string;
  private viewPromise: Promise<TContent | undefined> | undefined;
  private editPromise: Promise<TContent | undefined> | undefined;

  constructor(
    private readonly selector: { id?: number; slug?: string },
    private readonly getById: (id: number, options?: ContentItemLoadOptions) => PromiseLike<TContent>,
    private readonly getBySlug: (slug: string, options?: ContentItemLoadOptions) => PromiseLike<TContent | undefined>,
    private readonly embedOption: boolean | string[] | undefined,
    private readonly editOptions?: {
      getEditById?: (id: number, fields?: string[]) => PromiseLike<TContent>;
      getEditBySlug?: (slug: string, fields?: string[]) => PromiseLike<TContent | undefined>;
      missingRawMessage?: string;
    },
  ) {
    super();
    this.missingRawMessage = editOptions?.missingRawMessage
      ?? 'Raw content is unavailable. The current credentials may not have edit capabilities for this content item.';
  }

  // ---------------------------------------------------------------------------
  // View-context loading
  // ---------------------------------------------------------------------------

  private async loadItemOnce(): Promise<TContent | undefined> {
    const opts: ContentItemLoadOptions | undefined =
      this.embedOption !== undefined ? { embed: this.embedOption } : undefined;

    if (typeof this.selector.id === 'number') {
      return this.getById(this.selector.id, opts);
    }

    if (typeof this.selector.slug === 'string') {
      return this.getBySlug(this.selector.slug, opts);
    }

    return undefined;
  }

  private loadItem(): Promise<TContent | undefined> {
    if (!this.viewPromise) {
      this.viewPromise = this.loadItemOnce();
    }

    return this.viewPromise;
  }

  // ---------------------------------------------------------------------------
  // Edit-context loading (raw content)
  // ---------------------------------------------------------------------------

  private async loadEditableItemOnce(): Promise<TContent | undefined> {
    if (typeof this.selector.id === 'number' && this.editOptions?.getEditById) {
      return this.editOptions.getEditById(this.selector.id, ['id', 'content']);
    }

    if (typeof this.selector.slug === 'string' && this.editOptions?.getEditBySlug) {
      return this.editOptions.getEditBySlug(this.selector.slug, ['id', 'content']);
    }

    return undefined;
  }

  private loadEditableItem(): Promise<TContent | undefined> {
    if (!this.editPromise) {
      this.editPromise = this.loadEditableItemOnce();
    }

    return this.editPromise;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Resolves raw and rendered content from an edit-context request.
   *
   * Requires authentication with edit capabilities. Used by the
   * `fluent-wp-client/blocks` add-on for Gutenberg block parsing.
   */
  async getContent(): Promise<WordPressRawContentResult | undefined> {
    const post = await this.loadEditableItem();

    if (!post) {
      return undefined;
    }

    return resolveWordPressRawContent(post as WordPressPostLike, this.missingRawMessage);
  }

  /**
   * Executes the view-context query. Memoized for repeated awaits.
   */
  protected execute(): Promise<TContent | undefined> {
    return this.loadItem();
  }
}
