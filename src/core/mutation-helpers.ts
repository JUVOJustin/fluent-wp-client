import type { WordPressRequestOverrides } from '../types/resources.js';
import {
  isStandardSchema,
  type WordPressStandardSchema,
} from './validation.js';

/**
 * Normalized mutation options after resolving schema/request overloads.
 */
export interface ResolvedMutationArguments<TResponse> {
  responseSchema?: WordPressStandardSchema<TResponse>;
  requestOptions?: WordPressRequestOverrides;
}

/**
 * Resolves overloaded mutation arguments shared by resource and settings helpers.
 */
export function resolveMutationArguments<TResponse>(
  responseSchemaOrRequestOptions?: WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
  requestOptions?: WordPressRequestOverrides,
): ResolvedMutationArguments<TResponse> {
  if (isStandardSchema(responseSchemaOrRequestOptions)) {
    return {
      responseSchema: responseSchemaOrRequestOptions,
      requestOptions,
    };
  }

  if (!responseSchemaOrRequestOptions) {
    return {
      responseSchema: undefined,
      requestOptions,
    };
  }

  // Deep merge headers to avoid losing nested header values
  const baseOptions = responseSchemaOrRequestOptions as WordPressRequestOverrides;
  const baseHeaders = baseOptions.headers;
  const overrideHeaders = requestOptions?.headers;

  const mergedHeaders =
    baseHeaders || overrideHeaders
      ? { ...baseHeaders, ...overrideHeaders }
      : undefined;

  return {
    responseSchema: undefined,
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
export function resolveMutationSchema<TResponse>(
  responseSchemaOrRequestOptions: WordPressStandardSchema<TResponse> | WordPressRequestOverrides | undefined,
  requestOptions: WordPressRequestOverrides | undefined,
  clientResponseSchema: WordPressStandardSchema<TResponse> | undefined,
): ResolvedMutationArguments<TResponse> {
  const resolved = resolveMutationArguments<TResponse>(
    responseSchemaOrRequestOptions,
    requestOptions,
  );

  return {
    requestOptions: resolved.requestOptions,
    responseSchema: resolved.responseSchema ?? clientResponseSchema,
  };
}
