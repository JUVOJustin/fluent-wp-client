import { WordPressClient } from "../client.js";
import type { WordPressClientConfig } from "../types/client.js";

/**
 * JSON Schema property definition from WordPress REST API discovery.
 */
export interface WPSchemaProperty {
  context?: string[];
  default?: unknown;
  description?: string;
  enum?: unknown[];
  format?: string;
  items?: WPSchemaProperty;
  properties?: Record<string, WPSchemaProperty>;
  readonly?: boolean;
  required?: boolean;
  type?: string | string[];
}

/**
 * Route schema from the WordPress REST API discovery document.
 */
export interface WPRouteSchema {
  $schema?: string;
  properties?: Record<string, WPSchemaProperty>;
  title?: string;
  type?: string;
}

/**
 * One route endpoint entry from WordPress REST discovery.
 */
export interface WPRouteEndpoint {
  args?: Record<string, WPSchemaProperty>;
  methods: string[];
}

/**
 * One route from the WordPress REST discovery document.
 */
export interface WPRoute {
  _links?: unknown;
  endpoints: WPRouteEndpoint[];
  methods: string[];
  namespace: string;
  schema?: WPRouteSchema;
}

/**
 * WordPress REST API discovery document shape.
 */
export interface WPDiscoveryDocument {
  description: string;
  home: string;
  name: string;
  namespaces: string[];
  routes: Record<string, WPRoute>;
  url: string;
}

/**
 * WordPress post type definition from /wp/v2/types.
 */
export interface WPPostType {
  _links?: unknown;
  description: string;
  name: string;
  rest_base: string;
  rest_namespace: string;
  slug: string;
  taxonomies: string[];
}

/**
 * WordPress taxonomy definition from /wp/v2/taxonomies.
 */
export interface WPTaxonomy {
  _links?: unknown;
  description: string;
  name: string;
  rest_base: string;
  rest_namespace: string;
  slug: string;
  types: string[];
}

/**
 * Discovered resource with its schema for code generation.
 */
export interface DiscoveredResource {
  kind: "post_type" | "taxonomy";
  name: string;
  restBase: string;
  schema: WPRouteSchema | undefined;
  slug: string;
}

/**
 * Optional include/exclude filters for CLI discovery.
 */
export interface DiscoveryResourceFilters {
  exclude?: string[];
  include?: string[];
}

/**
 * Returns whether one resource matches a CLI filter token.
 */
function matchesResourceToken(
  resource: { slug: string; rest_base: string },
  token: string,
): boolean {
  const normalizedToken = token.trim().toLowerCase();
  return (
    resource.slug.toLowerCase() === normalizedToken ||
    resource.rest_base.toLowerCase() === normalizedToken
  );
}

/**
 * Applies include/exclude filters using either slug or rest base.
 */
function shouldDiscoverResource(
  resource: { slug: string; rest_base: string },
  filters?: DiscoveryResourceFilters,
): boolean {
  if (filters?.include && filters.include.length > 0) {
    const included = filters.include.some((token) =>
      matchesResourceToken(resource, token),
    );

    if (!included) {
      return false;
    }
  }

  if (
    filters?.exclude?.some((token) => matchesResourceToken(resource, token))
  ) {
    return false;
  }

  return true;
}

/**
 * Builds one request endpoint for resource schema discovery.
 */
function createSchemaEndpoint(
  restNamespace: string | undefined,
  restBase: string,
): string {
  const namespace = (restNamespace || "wp/v2").replace(/^\/+|\/+$/g, "");
  const resource = restBase.replace(/^\/+|\/+$/g, "");

  if (namespace === "wp/v2") {
    return `/${resource}`;
  }

  return `/wp-json/${namespace}/${resource}`;
}

/**
 * Resolves one resource schema from the route OPTIONS response, with discovery fallback.
 */
async function fetchResourceSchema(
  client: WordPressClient,
  route: WPRoute | undefined,
  restNamespace: string | undefined,
  restBase: string,
): Promise<WPRouteSchema | undefined> {
  if (route?.schema?.properties) {
    return route.schema;
  }

  try {
    const response = await client.request<WPRoute>({
      endpoint: createSchemaEndpoint(restNamespace, restBase),
      method: "OPTIONS",
    });

    return response.data.schema;
  } catch (err) {
    // Log the error for debugging but return the fallback schema
    console.warn(`Failed to fetch schema for ${restBase}:`, err);
    return route?.schema;
  }
}

/**
 * Connects to a WordPress instance and discovers all registered resources
 * and their REST API schemas.
 */
export async function discoverWordPress(
  config: WordPressClientConfig,
): Promise<{
  siteName: string;
  siteUrl: string;
  resources: DiscoveredResource[];
}>;
export async function discoverWordPress(
  config: WordPressClientConfig,
  filters: DiscoveryResourceFilters,
): Promise<{
  siteName: string;
  siteUrl: string;
  resources: DiscoveredResource[];
}>;
export async function discoverWordPress(
  config: WordPressClientConfig,
  filters?: DiscoveryResourceFilters,
): Promise<{
  siteName: string;
  siteUrl: string;
  resources: DiscoveredResource[];
}> {
  const client = new WordPressClient(config);
  const runtime = client.getRuntime();

  // Fetch discovery document.
  const discovery = await runtime.fetchAPI<WPDiscoveryDocument>(
    "/wp-json/",
    {},
  );

  // Fetch registered post types.
  const typesResponse = await runtime.fetchAPI<Record<string, WPPostType>>(
    "/types",
    {},
  );

  // Fetch registered taxonomies.
  const taxonomiesResponse = await runtime.fetchAPI<Record<string, WPTaxonomy>>(
    "/taxonomies",
    {},
  );

  const resources: DiscoveredResource[] = [];

  // Collect post type resources.
  for (const pt of Object.values(typesResponse)) {
    if (!pt.rest_base) continue;
    if (!shouldDiscoverResource(pt, filters)) continue;
    const routeKey = createSchemaEndpoint(pt.rest_namespace, pt.rest_base);
    const route = discovery.routes[routeKey];

    resources.push({
      kind: "post_type",
      name: pt.name,
      restBase: pt.rest_base,
      schema: await fetchResourceSchema(
        client,
        route,
        pt.rest_namespace,
        pt.rest_base,
      ),
      slug: pt.slug,
    });
  }

  // Collect taxonomy resources.
  for (const tax of Object.values(taxonomiesResponse)) {
    if (!tax.rest_base) continue;
    if (!shouldDiscoverResource(tax, filters)) continue;
    const routeKey = createSchemaEndpoint(tax.rest_namespace, tax.rest_base);
    const route = discovery.routes[routeKey];

    resources.push({
      kind: "taxonomy",
      name: tax.name,
      restBase: tax.rest_base,
      schema: await fetchResourceSchema(
        client,
        route,
        tax.rest_namespace,
        tax.rest_base,
      ),
      slug: tax.slug,
    });
  }

  return {
    resources,
    siteName: discovery.name,
    siteUrl: discovery.url,
  };
}
