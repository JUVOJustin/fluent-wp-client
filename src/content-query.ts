import type { WordPressPostBase } from './schemas.js';
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
 * Shared method surface exposed by query and record wrappers.
 */
export interface WordPressContentMethods<TContent extends WordPressPostBase> {
  get: () => Promise<TContent>;
  getContent: () => Promise<WordPressRawContentResult>;
  getBlocks: (options?: WordPressGetBlocksOptions) => Promise<WordPressParsedBlock[]>;
}

/**
 * Post-like record instance that keeps original fields and adds block helpers.
 */
export type WordPressContentRecord<TContent extends WordPressPostBase> =
  TContent
  & WordPressContentMethods<TContent>
  & PromiseLike<TContent>;

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
 * Builds one post-like record wrapper from already loaded view-context data.
 */
export function createWordPressContentRecord<TContent extends WordPressPostBase>(config: {
  value: TContent;
  loadEdit: () => Promise<TContent>;
  missingRawMessage: string;
  defaultBlockParser?: WordPressBlockParser;
}): WordPressContentRecord<TContent> {
  let editPromise: Promise<TContent> | undefined;

  const get = async (): Promise<TContent> => {
    return config.value;
  };

  const getContent = async (): Promise<WordPressRawContentResult> => {
    if (config.value.content.raw !== undefined) {
      return resolveWordPressRawContent(config.value, config.missingRawMessage);
    }

    if (!editPromise) {
      editPromise = config.loadEdit();
    }

    const editValue = await editPromise;
    return resolveWordPressRawContent(editValue, config.missingRawMessage);
  };

  const getBlocks = async (options: WordPressGetBlocksOptions = {}): Promise<WordPressParsedBlock[]> => {
    const content = await getContent();
    return parseWordPressBlocks(content.raw, options.parser ?? config.defaultBlockParser);
  };

  const then: PromiseLike<TContent>['then'] = (onfulfilled, onrejected) => {
    return get().then(onfulfilled, onrejected);
  };

  return Object.assign(config.value, {
    get,
    getContent,
    getBlocks,
    then,
  });
}

/**
 * Promise-like content query that adds Gutenberg block parsing helpers.
 */
export class WordPressContentQuery<TContent extends WordPressPostBase | undefined> implements PromiseLike<TContent> {
  private viewPromise: Promise<TContent> | undefined;
  private editPromise: Promise<TContent> | undefined;

  constructor(
    private readonly loadView: () => Promise<TContent>,
    private readonly loadEdit: () => Promise<TContent>,
    private readonly missingRawMessage: string,
    private readonly defaultBlockParser?: WordPressBlockParser,
  ) {}

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
   * Supports direct `await` usage by delegating to `get()`.
   */
  then<TResult1 = TContent, TResult2 = never>(
    onfulfilled?: ((value: TContent) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.get().then(onfulfilled, onrejected);
  }
}
