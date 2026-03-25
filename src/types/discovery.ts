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
  item?: WordPressJsonSchema;
  collection?: WordPressJsonSchema;
  create?: WordPressJsonSchema;
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
 * Description of a content or term resource with its schemas.
 */
export interface WordPressResourceDescription {
  kind: 'content' | 'term' | 'resource';
  resource: string;   // e.g., posts, pages, books, categories, tags, genre
  slug?: string;      // e.g., post, page, book, category, post_tag, genre
  restBase?: string;  // e.g., posts, pages, books, categories, tags, genre
  namespace: string;  // usually wp/v2
  route: string;      // e.g., /wp-json/wp/v2/books
  schemas: WordPressResourceSchemaSet;
  raw?: Record<string, unknown>;
}

/**
 * Description of an ability with its schemas and annotations.
 */
export interface WordPressAbilityDescription {
  kind: 'ability';
  name: string;
  route: string;
  schemas: WordPressAbilitySchemaSet;
  annotations?: Record<string, unknown>;
  raw?: Record<string, unknown>;
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
  content: Record<string, WordPressResourceDescription>;
  terms: Record<string, WordPressResourceDescription>;
  resources: Record<string, WordPressResourceDescription>;
  abilities: Record<string, WordPressAbilityDescription>;
  warnings?: WordPressDiscoveryWarning[];
}

/**
 * Options for the `explore()` method.
 */
export interface WordPressDiscoveryOptions {
  /**
   * Bypass cache and force fresh discovery.
   */
  refresh?: boolean;

  /**
   * Limit discovery to specific kinds.
   * Defaults to all kinds if not specified.
   */
  include?: Array<'content' | 'terms' | 'resources' | 'abilities'>;
}

/**
 * Raw REST API type information for content types.
 */
export interface WordPressTypeInfo {
  slug: string;
  name: string;
  rest_base?: string;
  rest_namespace?: string;
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
  slug: string;
  name: string;
  rest_base?: string;
  rest_namespace?: string;
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
  methods?: string[];
  schema?: WordPressJsonSchema;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Parsed endpoint schema information.
 */
export interface ParsedEndpointSchema {
  item?: WordPressJsonSchema;
  create?: WordPressJsonSchema;
  collection?: WordPressJsonSchema;
  update?: WordPressJsonSchema;
}

/**
 * REST API route argument shape.
 */
export interface WordPressRouteArg {
  type?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  items?: WordPressRouteArg;
  properties?: Record<string, WordPressRouteArg>;
  [key: string]: unknown;
}

/**
 * REST API schema property shape.
 */
export interface WordPressSchemaProperty {
  type?: string | string[];
  description?: string;
  format?: string;
  readonly?: boolean;
  items?: WordPressSchemaProperty;
  properties?: Record<string, WordPressSchemaProperty>;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}
