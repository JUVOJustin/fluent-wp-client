/**
 * Pattern matching double-encoded HTML entities.
 *
 * Matches `&amp;` followed by a known entity name or numeric reference:
 * - `&amp;amp;`  → `&amp;`
 * - `&amp;lt;`   → `&lt;`
 * - `&amp;gt;`   → `&gt;`
 * - `&amp;quot;` → `&quot;`
 * - `&amp;#39;`  → `&#39;`
 * - `&amp;#x3C;` → `&#x3C;`
 *
 * This is intentionally conservative. It only strips the *outer* `&amp;`
 * layer when the inner token is unambiguously a valid HTML entity.
 */
const DOUBLE_ENCODED_ENTITY_PATTERN =
  /&amp;(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;

/**
 * Decodes one double-encoded entity match.
 */
function decodeDoubleEncodedEntity(
  _match: string,
  innerEntity: string,
): string {
  return `&${innerEntity};`;
}

/**
 * Field path suffixes where WordPress intentionally applies HTML output
 * filters and double-encoding bugs are known to occur.
 *
 * WordPress REST API uses the `.rendered` convention to indicate fields
 * passed through HTML display filters (`wptexturize`, `esc_html`, etc.).
 * These are the only fields where double-encoded entities like `&amp;amp;`
 * legitimately appear.
 */
const NORMALIZED_PATH_SUFFIXES = [
  // Post/page/media/comment content-bearing fields
  ".rendered",
] as const;

function shouldNormalizeAtPath(path: string): boolean {
  return NORMALIZED_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

/**
 * Normalizes a single string value by fixing double-encoded HTML entities.
 *
 * WordPress' REST API occasionally double-escapes `&`, `<`, `>`, `"`, etc.
 * in rendered fields (`title.rendered`, `content.rendered`, `excerpt.rendered`).
 * This helper detects the `&amp;{entity};` pattern and removes the outer layer.
 */
export function normalizeWordPressString(value: string): string {
  return value.replace(
    DOUBLE_ENCODED_ENTITY_PATTERN,
    decodeDoubleEncodedEntity,
  );
}

/**
 * Recursively normalizes double-encoded HTML entities in a JSON-like value.
 *
 * Only strings at known WordPress HTML field paths are scanned — primarily
 * paths ending in `.rendered` (title.rendered, content.rendered,
 * excerpt.rendered, caption.rendered, description.rendered, etc.).
 *
 * - Arrays and plain objects are walked recursively.
 * - Primitives (number, boolean, null) and other types are returned unchanged.
 *
 * The function mutates the input value (and nested objects/arrays) in place
 * to avoid unnecessary allocations for large REST payloads.
 */
export function normalizeWordPressResponse<T>(value: T, path = ""): T {
  if (typeof value === "string") {
    if (shouldNormalizeAtPath(path)) {
      return normalizeWordPressString(value) as T;
    }

    return value;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const childPath = `${path}[${i}]`;
      const normalized = normalizeWordPressResponse(value[i], childPath);

      if (normalized !== value[i]) {
        value[i] = normalized;
      }
    }

    return value;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    value.constructor === Object
  ) {
    for (const key of Object.keys(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const normalized = normalizeWordPressResponse(
        (value as Record<string, unknown>)[key],
        childPath,
      );

      if (normalized !== (value as Record<string, unknown>)[key]) {
        (value as Record<string, unknown>)[key] = normalized;
      }
    }

    return value;
  }

  // Primitives, Dates, RegExps, class instances, etc. are left untouched.
  return value;
}
