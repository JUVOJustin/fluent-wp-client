/**
 * Parsed Gutenberg block shape exposed by fluent-wp-client.
 */
export interface WordPressParsedBlock {
  blockName: string | null;
  attrs: Record<string, unknown> | null;
  innerBlocks: WordPressParsedBlock[];
  innerHTML: string;
  innerContent: Array<string | null>;
}

/**
 * Function signature for one Gutenberg block parser implementation.
 */
export type WordPressBlockParser = (rawContent: string) => WordPressParsedBlock[];

/**
 * Lazily loads the default Gutenberg block parser implementation.
 */
export async function loadDefaultWordPressBlockParser(): Promise<WordPressBlockParser> {
  const parserModule = await import('@wordpress/block-serialization-default-parser');

  return (rawContent: string): WordPressParsedBlock[] => {
    return parserModule.parse(rawContent) as WordPressParsedBlock[];
  };
}

/**
 * Parses serialized Gutenberg content into structured block data.
 */
export async function parseWordPressBlocks(
  rawContent: string,
  parser?: WordPressBlockParser,
): Promise<WordPressParsedBlock[]> {
  const runtimeParser = parser ?? await loadDefaultWordPressBlockParser();
  return runtimeParser(rawContent);
}
