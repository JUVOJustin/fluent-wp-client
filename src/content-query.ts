import {
  parseWordPressBlocks,
  type WordPressBlockParser,
  type WordPressParsedBlock,
} from './blocks.js';

/**
 * Normalized content payload returned for block-oriented workflows.
 */
export interface WordPressRawContentResult {
  raw: string;
  rendered: string;
  protected: boolean;
}

/**
 * Optional overrides supported by one `getBlocks()` call.
 */
export interface WordPressGetBlocksOptions {
  parser?: WordPressBlockParser;
}

/**
 * Promise-like content query that adds Gutenberg block parsing helpers.
 */
export class WordPressContentQuery<TResult> implements PromiseLike<TResult> {
  private viewPromise: Promise<TResult> | undefined;
  private editPromise: Promise<TResult> | undefined;

  constructor(
    private readonly loadView: () => Promise<TResult>,
    private readonly loadEdit: () => Promise<TResult>,
    private readonly resolveRawContent: (result: TResult) => WordPressRawContentResult | undefined,
    private readonly defaultBlockParser?: WordPressBlockParser,
  ) {}

  /**
   * Resolves the standard resource payload from one view-context request.
   */
  async get(): Promise<TResult> {
    if (!this.viewPromise) {
      this.viewPromise = this.loadView();
    }

    return this.viewPromise;
  }

  /**
   * Resolves raw and rendered content from one edit-context request.
   */
  async getContent(): Promise<WordPressRawContentResult | undefined> {
    if (!this.editPromise) {
      this.editPromise = this.loadEdit();
    }

    const result = await this.editPromise;
    return this.resolveRawContent(result);
  }

  /**
   * Parses raw content into Gutenberg blocks from one edit-context request.
   */
  async getBlocks(options: WordPressGetBlocksOptions = {}): Promise<WordPressParsedBlock[] | undefined> {
    const content = await this.getContent();

    if (!content) {
      return undefined;
    }

    return parseWordPressBlocks(content.raw, options.parser ?? this.defaultBlockParser);
  }

  /**
   * Supports direct `await` usage by delegating to `get()`.
   */
  then<TResult1 = TResult, TResult2 = never>(
    onfulfilled?: ((value: TResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.get().then(onfulfilled, onrejected);
  }
}
