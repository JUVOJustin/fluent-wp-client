import { parseWordPressBlocks, type WordPressParsedBlock } from "../blocks.js";
import type { WordPressClient } from "../client.js";
import type { WordPressRawContentResult } from "../content-query.js";
import {
  WordPressClientError,
  type WordPressClientErrorKind,
  WordPressHttpError,
} from "../core/errors.js";
import type { WordPressPostLike } from "../schemas.js";
import { mergeToolArgs } from "./merge.js";
import type { ToolFactoryOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Type assertions
// ---------------------------------------------------------------------------

/**
 * Type assertion helper to convert AI SDK tool args to a generic record.
 * Use this instead of double-casting through `unknown` for consistency.
 */
export function asToolArgs<T extends Record<string, unknown>>(
  args: T,
): Record<string, unknown> {
  return args as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Field normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes `_fields` alias to `fields` so the client's `filterToParams`
 * maps it correctly to the WordPress `_fields` query parameter.
 */
export function normalizeFieldSelection(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...args };
  if (result._fields && !result.fields) {
    result.fields = result._fields;
  }
  delete result._fields;
  return result;
}

/**
 * Merges tool options and normalizes field selection in one step.
 */
export function prepareCollectionArgs(
  modelArgs: Record<string, unknown>,
  options?: ToolFactoryOptions<Record<string, unknown>>,
): Record<string, unknown> {
  const merged = mergeToolArgs(modelArgs, options?.fixedArgs);
  return normalizeFieldSelection(merged);
}

// ---------------------------------------------------------------------------
// Tool error envelopes
// ---------------------------------------------------------------------------

/**
 * Serializable error shape returned by AI SDK tools when execution fails.
 */
export interface WordPressAIToolErrorResult {
  error: {
    kind: WordPressClientErrorKind | "tool_error";
    message: string;
    code?: string;
    status?: number;
    statusText?: string;
    details?: unknown;
  };
  ok: false;
}

/**
 * Converts thrown runtime errors into a stable, model-readable envelope.
 */
export function toToolErrorResult(error: unknown): WordPressAIToolErrorResult {
  if (error instanceof WordPressHttpError) {
    return {
      error: {
        code: error.wpCode,
        details: error.responseBody,
        kind: error.kind,
        message: error.message,
        status: error.status,
        statusText: error.statusText,
      },
      ok: false,
    };
  }

  if (error instanceof WordPressClientError) {
    return {
      error: {
        kind: error.kind,
        message: error.message,
      },
      ok: false,
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        kind: "tool_error",
        message: error.message,
      },
      ok: false,
    };
  }

  return {
    error: {
      details: error,
      kind: "tool_error",
      message: "Unknown tool execution error",
    },
    ok: false,
  };
}

/**
 * Wraps tool execution so WordPress and runtime failures stay machine-readable.
 */
export function withToolErrorHandling<TArgs, TResult>(
  execute: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult | WordPressAIToolErrorResult> {
  return async (args: TArgs) => {
    try {
      return await execute(args);
    } catch (error) {
      return toToolErrorResult(error);
    }
  };
}

// ---------------------------------------------------------------------------
// Content query envelope
// ---------------------------------------------------------------------------

/**
 * Envelope returned by post-like single getter tools.
 */
export interface ContentItemResult<T> {
  blocks?: WordPressParsedBlock[];
  content?: WordPressRawContentResult;
  item: T;
}

/**
 * Resolves a WordPressContentQuery into a plain serializable envelope.
 */
export interface ContentQueryLike<
  TContent extends WordPressPostLike | undefined,
> {
  getContent(): Promise<WordPressRawContentResult | undefined>;
  then<TResult1 = TContent, TResult2 = never>(
    onfulfilled?:
      | ((value: TContent) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

/**
 * Resolves a post-like item query into a plain serializable envelope.
 */
export async function resolveContentQuery<
  TContent extends WordPressPostLike | undefined,
>(
  query: ContentQueryLike<TContent>,
  args: { includeContent?: boolean; includeBlocks?: boolean },
): Promise<ContentItemResult<TContent> | undefined> {
  const item = await query;
  if (item === undefined) return undefined;

  let content: WordPressRawContentResult | undefined;
  if (args.includeContent || args.includeBlocks) {
    content = (await query.getContent()) ?? undefined;
  }

  let blocks: WordPressParsedBlock[] | undefined;
  if (args.includeBlocks) {
    blocks = content?.raw ? await parseWordPressBlocks(content.raw) : undefined;
  }

  return { blocks, content, item };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { ContentItemResult as WordPressAIContentItemResult };
