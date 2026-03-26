/**
 * JSON Schema discovery APIs for WordPress REST resources and abilities.
 *
 * Discovery exposes payload shapes for upstream introspection, AI/tool
 * generation, and schema-aware integrations.
 */

import type {
  WordPressDiscoveryCatalog,
  WordPressDiscoveryOptions,
  WordPressDiscoveryWarning,
  WordPressResourceDescription,
  WordPressAbilityDescription,
  WordPressTypesResponse,
  WordPressTaxonomiesResponse,
  WordPressEndpointSchema,
  WordPressResourceSchemaSet,
  WordPressAbilitySchemaSet,
  WordPressJsonSchema,
} from './types/discovery.js';
import type { WordPressAbility } from './schemas.js';
import { throwIfWordPressError } from './core/errors.js';
import { applyRequestOverrides } from './core/request-overrides.js';
import type { WordPressRuntime } from './core/transport.js';
import type { WordPressRequestOverrides } from './types/resources.js';

/**
 * Cache for discovery results per client instance.
 */
interface DiscoveryCache {
  catalog?: WordPressDiscoveryCatalog;
  content: Map<string, WordPressResourceDescription>;
  terms: Map<string, WordPressResourceDescription>;
  resources: Map<string, WordPressResourceDescription>;
  abilities: Map<string, WordPressAbilityDescription>;
}

/**
 * Creates an empty discovery cache.
 */
function createDiscoveryCache(): DiscoveryCache {
  return {
    content: new Map(),
    terms: new Map(),
    resources: new Map(),
    abilities: new Map(),
  };
}

/**
 * Omits undefined properties so discovery DTOs survive JSON round-tripping.
 */
function compactOptionalProperties<T extends object>(value: T): T {
  const compacted: Record<string, unknown> = {};

  for (const [key, propertyValue] of Object.entries(value)) {
    if (propertyValue !== undefined) {
      compacted[key] = propertyValue;
    }
  }

  return compacted as T;
}

/**
 * Creates one resource schema set without undefined keys.
 */
function createResourceSchemaSet(value: WordPressResourceSchemaSet): WordPressResourceSchemaSet {
  return compactOptionalProperties(value);
}

/**
 * Creates one ability schema set without undefined keys.
 */
function createAbilitySchemaSet(value: WordPressAbilitySchemaSet): WordPressAbilitySchemaSet {
  return compactOptionalProperties(value);
}

/**
 * Builds one serializable resource description from one OPTIONS response.
 */
function createResourceDescription(config: {
  kind: WordPressResourceDescription['kind'];
  resource: string;
  namespace: string;
  route: string;
  restBase?: string;
  slug?: string;
  endpointSchema: WordPressEndpointSchema;
}): WordPressResourceDescription {
  const itemSchema = config.endpointSchema.schema;
  const collectionSchema = itemSchema
    ? { type: 'array', items: itemSchema }
    : undefined;
  const createSchema = buildCreateSchema(config.endpointSchema);
  const updateSchema = buildUpdateSchema(createSchema);

  return {
    kind: config.kind,
    resource: config.resource,
    slug: config.slug,
    restBase: config.restBase,
    namespace: config.namespace,
    route: config.route,
    schemas: createResourceSchemaSet({
      item: itemSchema,
      collection: collectionSchema,
      create: createSchema,
      update: updateSchema,
    }),
    raw: config.endpointSchema,
  };
}

/**
 * Resolves one post type descriptor from the `/types` response.
 */
function findContentTypeInfo(
  types: WordPressTypesResponse,
  resource: string,
): { slug: string; rest_base?: string; rest_namespace?: string } | undefined {
  for (const [slug, info] of Object.entries(types)) {
    if (info.rest_base === resource) {
      return { slug, rest_base: info.rest_base, rest_namespace: info.rest_namespace };
    }
  }

  return undefined;
}

/**
 * Resolves one taxonomy descriptor from the `/taxonomies` response.
 */
function findTaxonomyInfo(
  taxonomies: WordPressTaxonomiesResponse,
  resource: string,
): { slug: string; rest_base?: string; rest_namespace?: string } | undefined {
  for (const [slug, info] of Object.entries(taxonomies)) {
    if (info.rest_base === resource) {
      return { slug, rest_base: info.rest_base, rest_namespace: info.rest_namespace };
    }
  }

  return undefined;
}

/**
 * Fetches and parses OPTIONS response from a REST endpoint.
 */
async function fetchEndpointSchema(
  runtime: WordPressRuntime,
  endpoint: string,
  options?: WordPressRequestOverrides,
): Promise<WordPressEndpointSchema | undefined> {
  try {
    const result = await runtime.request<WordPressEndpointSchema>(applyRequestOverrides({
      endpoint,
      method: 'OPTIONS',
    }, options));

    throwIfWordPressError(result.response, result.data);

    return result.data;
  } catch (error) {
    return undefined;
  }
}

/**
 * Converts REST API args to JSON Schema properties.
 */
function argsToJsonSchemaProperties(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const [key, arg] of Object.entries(args)) {
    if (arg && typeof arg === 'object') {
      const argDef = arg as Record<string, unknown>;
      const schema: Record<string, unknown> = {};

      if (argDef.type !== undefined) {
        schema.type = argDef.type;
      }
      if (argDef.description !== undefined) {
        schema.description = argDef.description;
      }
      if (argDef.default !== undefined) {
        schema.default = argDef.default;
      }
      if (argDef.enum !== undefined) {
        schema.enum = argDef.enum;
      }
      if (argDef.items !== undefined) {
        schema.items = argDef.items;
      }

      properties[key] = schema;
    }
  }

  return properties;
}

/**
 * Determines required fields from REST API args.
 */
function getRequiredFields(
  args: Record<string, unknown>,
): string[] {
  const required: string[] = [];

  for (const [key, arg] of Object.entries(args)) {
    if (arg && typeof arg === 'object' && (arg as Record<string, unknown>).required === true) {
      required.push(key);
    }
  }

  return required;
}

/**
 * Builds create schema from POST args in endpoint OPTIONS response.
 */
function buildCreateSchema(
  endpointSchema: WordPressEndpointSchema,
): WordPressResourceSchemaSet['create'] {
  if (!endpointSchema.args || typeof endpointSchema.args !== 'object') {
    return undefined;
  }

  const properties = argsToJsonSchemaProperties(endpointSchema.args);
  const required = getRequiredFields(endpointSchema.args);

  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema as WordPressResourceSchemaSet['create'];
}

/**
 * Builds update schema from create schema (no required fields).
 */
function buildUpdateSchema(
  createSchema: WordPressResourceSchemaSet['create'],
): WordPressResourceSchemaSet['update'] {
  if (!createSchema) {
    return undefined;
  }

  const update = { ...createSchema };
  delete update.required;

  return update as WordPressResourceSchemaSet['update'];
}

/**
 * Discovers schema for a content resource (post type).
 */
async function discoverContentResource(
  runtime: WordPressRuntime,
  resource: string,
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {
  const types = await runtime.fetchAPI<WordPressTypesResponse>('/wp-json/wp/v2/types', undefined, options);
  const typeInfo = findContentTypeInfo(types, resource);

  if (!typeInfo) {
    throw new Error(`Content resource '${resource}' not found in WordPress types`);
  }

  return discoverContentResourceFromTypeInfo(runtime, resource, typeInfo, options);
}

/**
 * Discovers schema for a content resource using one pre-fetched type descriptor.
 */
async function discoverContentResourceFromTypeInfo(
  runtime: WordPressRuntime,
  resource: string,
  typeInfo: { slug: string; rest_base?: string; rest_namespace?: string },
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {
  
  const namespace = typeInfo.rest_namespace || 'wp/v2';
  const restBase = typeInfo.rest_base || resource;
  const route = `/wp-json/${namespace}/${restBase}`;

  // Step 2: Get OPTIONS from the collection endpoint
  const endpointSchema = await fetchEndpointSchema(
    runtime,
    route,
    options,
  );

  if (!endpointSchema) {
    throw new Error(`Failed to fetch schema for content resource '${resource}'`);
  }

  return createResourceDescription({
    kind: 'content',
    resource,
    slug: typeInfo.slug,
    restBase,
    namespace,
    route,
    endpointSchema,
  });
}

/**
 * Discovers schema for a term resource (taxonomy).
 */
async function discoverTermResource(
  runtime: WordPressRuntime,
  resource: string,
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {
  const taxonomies = await runtime.fetchAPI<WordPressTaxonomiesResponse>('/wp-json/wp/v2/taxonomies', undefined, options);
  const taxonomyInfo = findTaxonomyInfo(taxonomies, resource);

  if (!taxonomyInfo) {
    throw new Error(`Term resource '${resource}' not found in WordPress taxonomies`);
  }

  return discoverTermResourceFromTypeInfo(runtime, resource, taxonomyInfo, options);
}

/**
 * Discovers schema for a term resource using one pre-fetched taxonomy descriptor.
 */
async function discoverTermResourceFromTypeInfo(
  runtime: WordPressRuntime,
  resource: string,
  taxonomyInfo: { slug: string; rest_base?: string; rest_namespace?: string },
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {

  const namespace = taxonomyInfo.rest_namespace || 'wp/v2';
  const restBase = taxonomyInfo.rest_base || resource;
  const route = `/wp-json/${namespace}/${restBase}`;

  // Step 2: Get OPTIONS from the collection endpoint
  const endpointSchema = await fetchEndpointSchema(
    runtime,
    route,
    options,
  );

  if (!endpointSchema) {
    throw new Error(`Failed to fetch schema for term resource '${resource}'`);
  }

  return createResourceDescription({
    kind: 'term',
    resource,
    slug: taxonomyInfo.slug,
    restBase,
    namespace,
    route,
    endpointSchema,
  });
}

/**
 * Discovers schema for a first-class resource (media, users, comments, settings).
 */
async function discoverFirstClassResource(
  runtime: WordPressRuntime,
  resource: string,
  restBase: string,
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {
  const namespace = 'wp/v2';
  const route = `/wp-json/${namespace}/${restBase}`;

  const endpointSchema = await fetchEndpointSchema(
    runtime,
    route,
    options,
  );

  if (!endpointSchema) {
    throw new Error(`Failed to fetch schema for resource '${resource}'`);
  }

  return createResourceDescription({
    kind: 'resource',
    resource,
    restBase,
    namespace,
    route,
    endpointSchema,
  });
}

/**
 * Discovers schema for an ability.
 */
async function discoverAbility(
  runtime: WordPressRuntime,
  name: string,
  options?: WordPressRequestOverrides,
): Promise<WordPressAbilityDescription> {
  const ABILITIES_BASE_ENDPOINT = '/wp-json/wp-abilities/v1';
  const route = `${ABILITIES_BASE_ENDPOINT}/abilities/${name}`;

  const ability = await runtime.fetchAPI<WordPressAbility>(route, undefined, options);

  return {
    kind: 'ability',
    name,
    route,
    schemas: createAbilitySchemaSet({
      input: ability.input_schema as WordPressAbilityDescription['schemas']['input'],
      output: ability.output_schema as WordPressAbilityDescription['schemas']['output'],
    }),
    annotations: ability.meta?.annotations || {},
    raw: ability,
  };
}

/**
 * Discovers all content resources.
 */
async function discoverAllContent(
  runtime: WordPressRuntime,
  options?: WordPressRequestOverrides,
): Promise<{
  resources: Record<string, WordPressResourceDescription>;
  warnings: WordPressDiscoveryWarning[];
}> {
  const resources: Record<string, WordPressResourceDescription> = {};
  const warnings: WordPressDiscoveryWarning[] = [];

  try {
    const types = await runtime.fetchAPI<WordPressTypesResponse>('/wp-json/wp/v2/types', undefined, options);

    for (const [, info] of Object.entries(types)) {
      if (!info.rest_base) {
        continue;
      }

      try {
        const description = await discoverContentResourceFromTypeInfo(
          runtime,
          info.rest_base,
          {
            slug: info.slug,
            rest_base: info.rest_base,
            rest_namespace: info.rest_namespace,
          },
          options,
        );
        resources[info.rest_base] = description;
      } catch (error) {
        warnings.push({
          key: `content:${info.rest_base}`,
          message: error instanceof Error ? error.message : `Failed to discover content resource '${info.rest_base}'`,
        });
      }
    }
  } catch (error) {
    warnings.push({
      key: 'content:types',
      message: error instanceof Error ? error.message : 'Failed to fetch content types',
    });
  }

  return { resources, warnings };
}

/**
 * Discovers all term resources.
 */
async function discoverAllTerms(
  runtime: WordPressRuntime,
  options?: WordPressRequestOverrides,
): Promise<{
  resources: Record<string, WordPressResourceDescription>;
  warnings: WordPressDiscoveryWarning[];
}> {
  const resources: Record<string, WordPressResourceDescription> = {};
  const warnings: WordPressDiscoveryWarning[] = [];

  try {
    const taxonomies = await runtime.fetchAPI<WordPressTaxonomiesResponse>('/wp-json/wp/v2/taxonomies', undefined, options);

    for (const [, info] of Object.entries(taxonomies)) {
      if (!info.rest_base) {
        continue;
      }

      try {
        const description = await discoverTermResourceFromTypeInfo(
          runtime,
          info.rest_base,
          {
            slug: info.slug,
            rest_base: info.rest_base,
            rest_namespace: info.rest_namespace,
          },
          options,
        );
        resources[info.rest_base] = description;
      } catch (error) {
        warnings.push({
          key: `terms:${info.rest_base}`,
          message: error instanceof Error ? error.message : `Failed to discover term resource '${info.rest_base}'`,
        });
      }
    }
  } catch (error) {
    warnings.push({
      key: 'terms:taxonomies',
      message: error instanceof Error ? error.message : 'Failed to fetch taxonomies',
    });
  }

  return { resources, warnings };
}

/**
 * Discovers first-class resources (media, users, comments, settings).
 */
async function discoverFirstClassResources(
  runtime: WordPressRuntime,
  options?: WordPressRequestOverrides,
): Promise<{
  resources: Record<string, WordPressResourceDescription>;
  warnings: WordPressDiscoveryWarning[];
}> {
  const resources: Record<string, WordPressResourceDescription> = {};
  const warnings: WordPressDiscoveryWarning[] = [];

  const firstClassEndpoints: Array<{ resource: string; restBase: string }> = [
    { resource: 'media', restBase: 'media' },
    { resource: 'users', restBase: 'users' },
    { resource: 'comments', restBase: 'comments' },
    { resource: 'settings', restBase: 'settings' },
  ];

  for (const { resource, restBase } of firstClassEndpoints) {
    try {
      const description = await discoverFirstClassResource(
        runtime,
        resource,
        restBase,
        options,
      );
      resources[resource] = description;
    } catch (error) {
      warnings.push({
        key: `resource:${resource}`,
        message: error instanceof Error ? error.message : `Failed to discover resource '${resource}'`,
      });
    }
  }

  return { resources, warnings };
}

/**
 * Discovers all abilities.
 */
async function discoverAllAbilities(
  runtime: WordPressRuntime,
  options?: WordPressRequestOverrides,
): Promise<{
  abilities: Record<string, WordPressAbilityDescription>;
  warnings: WordPressDiscoveryWarning[];
}> {
  const abilities: Record<string, WordPressAbilityDescription> = {};
  const warnings: WordPressDiscoveryWarning[] = [];

  const ABILITIES_BASE_ENDPOINT = '/wp-json/wp-abilities/v1';

  try {
    const abilityList = await runtime.fetchAPI<Array<{ name: string }>>(
      `${ABILITIES_BASE_ENDPOINT}/abilities`,
      undefined,
      options,
    );

    for (const ability of abilityList) {
      try {
        const description = await discoverAbility(
          runtime,
          ability.name,
          options,
        );
        abilities[ability.name] = description;
      } catch (error) {
        warnings.push({
          key: `ability:${ability.name}`,
          message: error instanceof Error ? error.message : `Failed to discover ability '${ability.name}'`,
        });
      }
    }
  } catch (error) {
    warnings.push({
      key: 'abilities:list',
      message: error instanceof Error ? error.message : 'Failed to fetch abilities list',
    });
  }

  return { abilities, warnings };
}

/**
 * Creates the discovery methods for a WordPress client.
 */
export function createDiscoveryMethods(runtime: WordPressRuntime) {
  const cache = createDiscoveryCache();

  function cacheDescriptions(catalog: {
    content?: Record<string, WordPressResourceDescription>;
    terms?: Record<string, WordPressResourceDescription>;
    resources?: Record<string, WordPressResourceDescription>;
    abilities?: Record<string, WordPressAbilityDescription>;
  }): void {
    for (const [resource, description] of Object.entries(catalog.content || {})) {
      cache.content.set(resource, description);
    }

    for (const [resource, description] of Object.entries(catalog.terms || {})) {
      cache.terms.set(resource, description);
    }

    for (const [resource, description] of Object.entries(catalog.resources || {})) {
      cache.resources.set(resource, description);
    }

    for (const [name, description] of Object.entries(catalog.abilities || {})) {
      cache.abilities.set(name, description);
    }
  }

  /**
   * Describes a content resource (post type) schema.
   */
  async function describeContent(
    resource: string,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressResourceDescription> {
    const cacheKey = resource;

    if (cache.content.has(cacheKey)) {
      return cache.content.get(cacheKey)!;
    }

    const description = await discoverContentResource(runtime, resource, options);
    cache.content.set(cacheKey, description);

    return description;
  }

  /**
   * Describes a term resource (taxonomy) schema.
   */
  async function describeTerm(
    resource: string,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressResourceDescription> {
    const cacheKey = resource;

    if (cache.terms.has(cacheKey)) {
      return cache.terms.get(cacheKey)!;
    }

    const description = await discoverTermResource(runtime, resource, options);
    cache.terms.set(cacheKey, description);

    return description;
  }

  /**
   * Describes a first-class resource schema.
   */
  async function describeResource(
    resource: 'media' | 'users' | 'comments' | 'settings',
    options?: WordPressRequestOverrides,
  ): Promise<WordPressResourceDescription> {
    const cacheKey = resource;

    if (cache.resources.has(cacheKey)) {
      return cache.resources.get(cacheKey)!;
    }

    const description = await discoverFirstClassResource(runtime, resource, resource, options);
    cache.resources.set(cacheKey, description);

    return description;
  }

  /**
   * Describes an ability schema.
   */
  async function describeAbility(
    name: string,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressAbilityDescription> {
    const cacheKey = name;

    if (cache.abilities.has(cacheKey)) {
      return cache.abilities.get(cacheKey)!;
    }

    const description = await discoverAbility(runtime, name, options);
    cache.abilities.set(cacheKey, description);

    return description;
  }

  /**
   * Explores and catalogs all discoverable resources.
   */
  async function explore(
    options?: WordPressDiscoveryOptions & WordPressRequestOverrides,
  ): Promise<WordPressDiscoveryCatalog> {
    const { refresh, include, ...requestOptions } = options || {};
    const shouldCacheFullCatalog = !include || include.length === 4;

    // Return cached catalog if available and not refreshing
    if (!refresh && cache.catalog) {
      return filterCatalog(cache.catalog, include);
    }

    if (refresh && !shouldCacheFullCatalog) {
      cache.catalog = undefined;
    }

    const includeKinds = include || ['content', 'terms', 'resources', 'abilities'];

    const catalog: WordPressDiscoveryCatalog = {
      content: {},
      terms: {},
      resources: {},
      abilities: {},
      warnings: [],
    };

    // Discover content resources
    if (includeKinds.includes('content')) {
      const { resources, warnings } = await discoverAllContent(runtime, requestOptions);
      catalog.content = resources;
      catalog.warnings!.push(...warnings);
      cacheDescriptions({ content: resources });
    }

    // Discover term resources
    if (includeKinds.includes('terms')) {
      const { resources, warnings } = await discoverAllTerms(runtime, requestOptions);
      catalog.terms = resources;
      catalog.warnings!.push(...warnings);
      cacheDescriptions({ terms: resources });
    }

    // Discover first-class resources
    if (includeKinds.includes('resources')) {
      const { resources, warnings } = await discoverFirstClassResources(runtime, requestOptions);
      catalog.resources = resources;
      catalog.warnings!.push(...warnings);
      cacheDescriptions({ resources });
    }

    // Discover abilities
    if (includeKinds.includes('abilities')) {
      const { abilities, warnings } = await discoverAllAbilities(runtime, requestOptions);
      catalog.abilities = abilities;
      catalog.warnings!.push(...warnings);
      cacheDescriptions({ abilities });
    }

    if (shouldCacheFullCatalog) {
      cache.catalog = catalog;
    }

    return filterCatalog(catalog, include);
  }

  /**
   * Filters a catalog based on include kinds.
   */
  function filterCatalog(
    catalog: WordPressDiscoveryCatalog,
    include?: Array<'content' | 'terms' | 'resources' | 'abilities'>,
  ): WordPressDiscoveryCatalog {
    if (!include || include.length === 4) {
      return catalog;
    }

    return {
      content: include.includes('content') ? catalog.content : {},
      terms: include.includes('terms') ? catalog.terms : {},
      resources: include.includes('resources') ? catalog.resources : {},
      abilities: include.includes('abilities') ? catalog.abilities : {},
      warnings: catalog.warnings,
    };
  }

  /**
   * Clears the discovery cache.
   */
  function clearCache(): void {
    cache.catalog = undefined;
    cache.content.clear();
    cache.resources.clear();
    cache.terms.clear();
    cache.abilities.clear();
  }

  return {
    describeContent,
    describeTerm,
    describeResource,
    describeAbility,
    explore,
    clearCache,
  };
}

/**
 * Type for discovery methods returned by createDiscoveryMethods.
 */
export type DiscoveryMethods = ReturnType<typeof createDiscoveryMethods>;
