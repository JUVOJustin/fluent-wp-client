import type { WordPressResourceDescription } from "../types/discovery.js";
import type { WordPressRequestOverrides } from "../types/resources.js";

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
