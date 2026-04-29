import type { WordPressResourceDescription } from "../types/discovery.js";
import type {
  WordPressRequestOverrides,
  WordPressSchemaValueOptions,
} from "../types/resources.js";

/**
 * Fallback describe handler used when discovery wiring is unavailable.
 */
export function describeUnavailable(
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {
  void options;
  return Promise.reject(
    new Error("describe() not available for this resource"),
  );
}

/**
 * Creates a schema-path reader backed by a resource's discovery descriptor.
 */
export function createSchemaValueGetter(
  describeFn: (
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressResourceDescription>,
): <T = unknown>(
  path: string,
  options?: WordPressSchemaValueOptions,
) => Promise<T | undefined> {
  return async <T = unknown>(
    path: string,
    options?: WordPressSchemaValueOptions,
  ): Promise<T | undefined> => {
    const { schema = "item", ...requestOptions } = options ?? {};
    const description = await describeFn(requestOptions);
    let value: unknown = description.schemas[schema];

    for (const segment of path.split(".").filter(Boolean)) {
      if (!value || typeof value !== "object") {
        return undefined;
      }

      value = (value as Record<string, unknown>)[segment];
    }

    return value as T | undefined;
  };
}
