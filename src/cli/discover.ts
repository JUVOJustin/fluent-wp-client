import { WordPressClient } from '../client.js';
import type { WordPressClientConfig } from '../types/client.js';

/**
 * JSON Schema property definition from WordPress REST API discovery.
 */
export interface WPSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  readonly?: boolean;
  context?: string[];
  required?: boolean;
  properties?: Record<string, WPSchemaProperty>;
  items?: WPSchemaProperty;
  format?: string;
}

/**
 * Route schema from the WordPress REST API discovery document.
 */
export interface WPRouteSchema {
  $schema?: string;
  title?: string;
  type?: string;
  properties?: Record<string, WPSchemaProperty>;
}

/**
 * One route endpoint entry from WordPress REST discovery.
 */
export interface WPRouteEndpoint {
  methods: string[];
  args?: Record<string, WPSchemaProperty>;
}

/**
 * One route from the WordPress REST discovery document.
 */
export interface WPRoute {
  namespace: string;
  methods: string[];
  endpoints: WPRouteEndpoint[];
  schema?: WPRouteSchema;
  _links?: unknown;
}

/**
 * WordPress REST API discovery document shape.
 */
export interface WPDiscoveryDocument {
  name: string;
  description: string;
  url: string;
  home: string;
  namespaces: string[];
  routes: Record<string, WPRoute>;
}

/**
 * WordPress post type definition from /wp/v2/types.
 */
export interface WPPostType {
  slug: string;
  name: string;
  description: string;
  rest_base: string;
  rest_namespace: string;
  taxonomies: string[];
  _links?: unknown;
}

/**
 * WordPress taxonomy definition from /wp/v2/taxonomies.
 */
export interface WPTaxonomy {
  slug: string;
  name: string;
  description: string;
  rest_base: string;
  rest_namespace: string;
  types: string[];
  _links?: unknown;
}

/**
 * Discovered resource with its schema for code generation.
 */
export interface DiscoveredResource {
  kind: 'post_type' | 'taxonomy';
  slug: string;
  name: string;
  restBase: string;
  schema: WPRouteSchema | undefined;
}

/**
 * Builds one request endpoint for resource schema discovery.
 */
function createSchemaEndpoint(restNamespace: string | undefined, restBase: string): string {
  const namespace = (restNamespace || 'wp/v2').replace(/^\/+|\/+$/g, '');
  const resource = restBase.replace(/^\/+|\/+$/g, '');

  if (namespace === 'wp/v2') {
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
      method: 'OPTIONS',
    });

    return response.data.schema;
  } catch {
    return route?.schema;
  }
}

/**
 * Connects to a WordPress instance and discovers all registered resources
 * and their REST API schemas.
 */
export async function discoverWordPress(config: WordPressClientConfig): Promise<{
  siteName: string;
  siteUrl: string;
  resources: DiscoveredResource[];
}> {
  const client = new WordPressClient(config);
  const runtime = client.getRuntime();

  // Fetch discovery document.
  const discovery = await runtime.fetchAPI<WPDiscoveryDocument>(
    '/wp-json/',
    {},
  );

  // Fetch registered post types.
  const typesResponse = await runtime.fetchAPI<Record<string, WPPostType>>(
    '/types',
    {},
  );

  // Fetch registered taxonomies.
  const taxonomiesResponse = await runtime.fetchAPI<Record<string, WPTaxonomy>>(
    '/taxonomies',
    {},
  );

  const resources: DiscoveredResource[] = [];

  // Collect post type resources.
  for (const pt of Object.values(typesResponse)) {
    if (!pt.rest_base) continue;
    const routeKey = `/${pt.rest_namespace ?? 'wp/v2'}/${pt.rest_base}`;
    const route = discovery.routes[routeKey];

    resources.push({
      kind: 'post_type',
      slug: pt.slug,
      name: pt.name,
      restBase: pt.rest_base,
      schema: await fetchResourceSchema(client, route, pt.rest_namespace, pt.rest_base),
    });
  }

  // Collect taxonomy resources.
  for (const tax of Object.values(taxonomiesResponse)) {
    if (!tax.rest_base) continue;
    const routeKey = `/${tax.rest_namespace ?? 'wp/v2'}/${tax.rest_base}`;
    const route = discovery.routes[routeKey];

    resources.push({
      kind: 'taxonomy',
      slug: tax.slug,
      name: tax.name,
      restBase: tax.rest_base,
      schema: await fetchResourceSchema(client, route, tax.rest_namespace, tax.rest_base),
    });
  }

  return {
    siteName: discovery.name,
    siteUrl: discovery.url,
    resources,
  };
}
