import type { WordPressRequestOverrides } from '../types/resources.js';
import {
  isStandardSchema,
  type WordPressStandardSchema,
} from './validation.js';

/**
 * Combined mutation options for create/update calls.
 *
 * Accepts an optional `inputSchema` for client-side input validation before the
 * API round-trip, an optional `responseSchema` to validate the server response,
 * and any per-request transport overrides (e.g. custom headers).
 *
 * When `inputSchema` is provided, input is validated and transformed by the
 * schema before it is sent to the server. Invalid input throws a
 * `WordPressSchemaValidationError` without making an HTTP request.
 *
 * @example
 * ```ts
 * const createSchema = z.fromJSONSchema(desc.schemas.create!);
 * const post = await wp.content('posts').create(input, {
 *   inputSchema: createSchema,
 *   responseSchema: postSchema,
 * });
 * ```
 */
export interface MutationOptions<TInput = unknown, TResponse = unknown> extends WordPressRequestOverrides {
  /** Schema used to validate and transform the mutation input before the request. */
  inputSchema?: WordPressStandardSchema<TInput>;
  /** Schema used to validate the mutation response from the server. */
  responseSchema?: WordPressStandardSchema<TResponse>;
}

/**
 * Normalized mutation options after resolving schema/request overloads.
 */
export interface ResolvedMutationArguments<TResponse, TInput = unknown> {
  responseSchema?: WordPressStandardSchema<TResponse>;
  inputSchema?: WordPressStandardSchema<TInput>;
  requestOptions?: WordPressRequestOverrides;
}

/**
 * Returns true when `value` is a plain MutationOptions object.
 * Distinguished from Standard Schema objects (checked separately) by the
 * presence of an `inputSchema` or `responseSchema` key.
 */
function isMutationOptions(value: unknown): value is MutationOptions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (isStandardSchema(value)) {
    return false;
  }

  return 'inputSchema' in value || 'responseSchema' in value;
}

/**
 * Resolves overloaded mutation arguments shared by resource and settings helpers.
 *
 * Accepted second-argument shapes:
 * - Standard Schema → treated as `responseSchema`
 * - `MutationOptions` (has `inputSchema` or `responseSchema` key) → full options object
 * - `WordPressRequestOverrides` (plain object without schema keys) → request options only
 */
export function resolveMutationArguments<TResponse, TInput = unknown>(
  responseSchemaOrMutationOptions?: WordPressStandardSchema<TResponse> | MutationOptions<TInput, TResponse> | WordPressRequestOverrides,
  requestOptions?: WordPressRequestOverrides,
): ResolvedMutationArguments<TResponse, TInput> {
  if (isStandardSchema(responseSchemaOrMutationOptions)) {
    return {
      responseSchema: responseSchemaOrMutationOptions,
      inputSchema: undefined,
      requestOptions,
    };
  }

  if (!responseSchemaOrMutationOptions) {
    return {
      responseSchema: undefined,
      inputSchema: undefined,
      requestOptions,
    };
  }

  // MutationOptions: has inputSchema and/or responseSchema keys
  if (isMutationOptions(responseSchemaOrMutationOptions)) {
    const { inputSchema, responseSchema, ...restOptions } =
      responseSchemaOrMutationOptions as MutationOptions<TInput, TResponse>;

    const baseHeaders = (restOptions as WordPressRequestOverrides).headers;
    const overrideHeaders = requestOptions?.headers;
    const mergedHeaders =
      baseHeaders || overrideHeaders
        ? { ...baseHeaders, ...overrideHeaders }
        : undefined;

    return {
      responseSchema: responseSchema as WordPressStandardSchema<TResponse> | undefined,
      inputSchema: inputSchema as WordPressStandardSchema<TInput> | undefined,
      requestOptions: {
        ...restOptions,
        ...requestOptions,
        ...(mergedHeaders && { headers: mergedHeaders }),
      },
    };
  }

  // Plain WordPressRequestOverrides — deep merge headers to avoid losing nested values
  const baseOptions = responseSchemaOrMutationOptions as WordPressRequestOverrides;
  const baseHeaders = baseOptions.headers;
  const overrideHeaders = requestOptions?.headers;

  const mergedHeaders =
    baseHeaders || overrideHeaders
      ? { ...baseHeaders, ...overrideHeaders }
      : undefined;

  return {
    responseSchema: undefined,
    inputSchema: undefined,
    requestOptions: {
      ...baseOptions,
      ...requestOptions,
      ...(mergedHeaders && { headers: mergedHeaders }),
    },
  };
}

/**
 * Resolves the effective mutation schema for client calls.
 * Combines the call-specific schema override with the client's default schema.
 */
export function resolveMutationSchema<TResponse, TInput = unknown>(
  responseSchemaOrMutationOptions: WordPressStandardSchema<TResponse> | MutationOptions<TInput, TResponse> | WordPressRequestOverrides | undefined,
  requestOptions: WordPressRequestOverrides | undefined,
  clientResponseSchema: WordPressStandardSchema<TResponse> | undefined,
): ResolvedMutationArguments<TResponse, TInput> {
  const resolved = resolveMutationArguments<TResponse, TInput>(
    responseSchemaOrMutationOptions,
    requestOptions,
  );

  return {
    requestOptions: resolved.requestOptions,
    responseSchema: resolved.responseSchema ?? clientResponseSchema,
    inputSchema: resolved.inputSchema,
  };
}
