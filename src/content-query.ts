import type { WordPressPostBase } from './schemas.js';
import {
  parseWordPressBlocks,
  type WordPressBlockParser,
  type WordPressParsedBlock,
} from './blocks.js';
import { ExecutableQuery } from './core/query-base.js';

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
 * Resolves raw and rendered content from one post-like API response.
 */
export function resolveWordPressRawContent(
  value: WordPressPostBase,
  missingRawMessage: string,
): WordPressRawContentResult {
  if (value.content.raw === undefined) {
    throw new Error(missingRawMessage);
  }

  return {
    raw: value.content.raw,
    rendered: value.content.rendered,
    protected: value.content.protected,
  };
}

/**
 * Promise-like content query that adds Gutenberg block parsing helpers.
 */
export class WordPressContentQuery<TContent extends WordPressPostBase | undefined>
  extends ExecutableQuery<TContent> {
  private viewPromise: Promise<TContent> | undefined;
  private editPromise: Promise<TContent> | undefined;

  constructor(
    private readonly loadView: () => Promise<TContent>,
    private readonly loadEdit: () => Promise<TContent>,
    private readonly missingRawMessage: string,
    private readonly defaultBlockParser?: WordPressBlockParser,
  ) {
    super();
  }

  /**
   * Resolves the standard resource payload from one view-context request.
   */
  async get(): Promise<TContent> {
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

    if (!result) {
      return undefined;
    }

    return resolveWordPressRawContent(result, this.missingRawMessage);
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
   * Resolves the standard resource payload for Promise-like usage.
   */
  protected execute(): Promise<TContent> {
    return this.get();
  }
}
