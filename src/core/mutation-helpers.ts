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

  return {
    responseSchema: undefined,
    requestOptions: { ...responseSchemaOrRequestOptions, ...requestOptions },
  };
}
