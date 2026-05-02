/**
 * Type definitions for JSON Schema discovery APIs.
 *
 * Discovery exposes the payload shapes for resource endpoints supported by
 * `fluent-wp-client` for upstream introspection, AI/tool generation, and
 * schema-aware integrations.
 */

/**
 * Generic JSON Schema shape for discovery results.
 */
export interface WordPressJsonSchema {
  [key: string]: unknown;
}

/**
 * Schema set for a resource endpoint covering item, collection, create,
 * and update payloads.
 */
export interface WordPressResourceSchemaSet {
  collection?: WordPressJsonSchema;
  create?: WordPressJsonSchema;
  item?: WordPressJsonSchema;
  update?: WordPressJsonSchema;
}

/**
 * Schema set for an ability covering input and output payloads.
 */
export interface WordPressAbilitySchemaSet {
  input?: WordPressJsonSchema;
  output?: WordPressJsonSchema;
}

/**
 * Normalized capability surface for a REST resource endpoint.
 *
 * Derived from the raw OPTIONS response so callers never need to parse
 * `raw.args` themselves.
 *
 * All fields are plain serializable values — safe to store in any KV store and
 * load back via `wp.useCatalog()`.
 */
export interface WordPressResourceCapabilities {
  /**
   * JSON Schemas for query params accepted by GET endpoints.
   * Includes plugin-added params such as `lang` (WPML), `acf_format`, etc.
   */
  queryParams: WordPressResourceQueryParamSchemas;
}

/**
 * Query param schemas for collection and single-item reads.
 */
export interface WordPressResourceQueryParamSchemas {
  collection: WordPressJsonSchema;
  item: WordPressJsonSchema;
}

/**
 * Description of a content or term resource with its schemas.
 */
export interface WordPressResourceDescription {
  /**
   * Normalized capability surface derived from the OPTIONS response.
   * Present on freshly fetched descriptions and on catalogs loaded via
   * `wp.useCatalog()` when the catalog was produced by this package.
   */
  capabilities?: WordPressResourceCapabilities;
  kind: "content" | "term" | "resource";
  namespace: string; // usually wp/v2
  raw?: Record<string, unknown>;
  resource: string; // e.g., posts, pages, books, categories, tags, genre
  restBase?: string; // e.g., posts, pages, books, categories, tags, genre
  route: string; // e.g., /wp-json/wp/v2/books
  schemas: WordPressResourceSchemaSet;
  slug?: string; // e.g., post, page, book, category, post_tag, genre
}

/**
 * Description of an ability with its schemas and annotations.
 */
export interface WordPressAbilityDescription {
  annotations?: Record<string, unknown>;
  kind: "ability";
  name: string;
  raw?: Record<string, unknown>;
  route: string;
  schemas: WordPressAbilitySchemaSet;
}

/**
 * Warning entry for resources that failed during discovery.
 */
export interface WordPressDiscoveryWarning {
  key: string;
  message: string;
  status?: number;
}

/**
 * Complete discovery catalog containing all discoverable resources and abilities.
 */
export interface WordPressDiscoveryCatalog {
  abilities: Record<string, WordPressAbilityDescription>;
  content: Record<string, WordPressResourceDescription>;
  resources: Record<string, WordPressResourceDescription>;
  terms: Record<string, WordPressResourceDescription>;
  warnings?: WordPressDiscoveryWarning[];
}

/**
 * Options for the `explore()` method.
 */
export interface WordPressDiscoveryOptions {
  /**
   * Limit discovery to specific kinds.
   * Defaults to all kinds if not specified.
   */
  include?: Array<"content" | "terms" | "resources" | "abilities">;
  /**
   * Bypass cache and force fresh discovery.
   */
  refresh?: boolean;
}

/**
 * Raw REST API type information for content types.
 */
export interface WordPressTypeInfo {
  name: string;
  rest_base?: string;
  rest_namespace?: string;
  slug: string;
  [key: string]: unknown;
}

/**
 * Raw REST API type collection response.
 */
export interface WordPressTypesResponse {
  [key: string]: WordPressTypeInfo;
}

/**
 * Raw REST API taxonomy information.
 */
export interface WordPressTaxonomyInfo {
  name: string;
  rest_base?: string;
  rest_namespace?: string;
  slug: string;
  [key: string]: unknown;
}

/**
 * Raw REST API taxonomy collection response.
 */
export interface WordPressTaxonomiesResponse {
  [key: string]: WordPressTaxonomyInfo;
}

/**
 * Raw REST API endpoint schema from OPTIONS response.
 */
export interface WordPressEndpointSchema {
  args?: Record<string, unknown>;
  methods?: string[];
  schema?: WordPressJsonSchema;
  [key: string]: unknown;
}

/**
 * Parsed endpoint schema information.
 */
export interface ParsedEndpointSchema {
  collection?: WordPressJsonSchema;
  create?: WordPressJsonSchema;
  item?: WordPressJsonSchema;
  update?: WordPressJsonSchema;
}

/**
 * REST API route argument shape.
 */
export interface WordPressRouteArg {
  default?: unknown;
  description?: string;
  enum?: unknown[];
  items?: WordPressRouteArg;
  properties?: Record<string, WordPressRouteArg>;
  required?: boolean;
  type?: string;
  [key: string]: unknown;
}

/**
 * REST API schema property shape.
 */
export interface WordPressSchemaProperty {
  default?: unknown;
  description?: string;
  enum?: unknown[];
  format?: string;
  items?: WordPressSchemaProperty;
  properties?: Record<string, WordPressSchemaProperty>;
  readonly?: boolean;
  type?: string | string[];
  [key: string]: unknown;
}
