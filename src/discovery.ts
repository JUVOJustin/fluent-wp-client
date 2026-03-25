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
import type { WordPressRuntime } from './core/transport.js';
import type { WordPressRequestOverrides } from './types/resources.js';
import type { WordPressStandardSchema } from './core/validation.js';

/**
 * Creates a Standard Schema-compatible validator from a JSON Schema.
 * This allows discovered JSON Schemas to be used directly with the client's
 * existing validation methods (create, update, ability.run, etc.).
 * 
 * @example
 * ```typescript
 * const description = await wp.content('posts').describe();
 * const post = await wp.content('posts').create(
 *   { title: 'Hello', content: 'World' },
 *   jsonSchemaToValidator(description.schemas.create)
 * );
 * ```
 */
export function jsonSchemaToValidator<T = unknown>(
  jsonSchema: WordPressJsonSchema | undefined,
): WordPressStandardSchema<T> | undefined {
  if (!jsonSchema) {
    return undefined;
  }

  // Return a Standard Schema-compatible wrapper
  return {
    '~standard': {
      version: 1,
      vendor: 'fluent-wp-client',
      validate: (value: unknown) => {
        const errors = validateAgainstJsonSchema(value, jsonSchema);
        
        if (errors.length > 0) {
          return {
            issues: errors.map(err => ({
              message: err.message,
              path: err.path,
            })),
          };
        }

        return { value: value as T };
      },
    },
  };
}

/**
 * Validation error from JSON Schema validation.
 */
interface JsonSchemaValidationError {
  message: string;
  path: Array<string | number | { key: string | number }>;
}

/**
 * Validates a value against a JSON Schema.
 * This is a simplified validator that handles common WordPress REST API patterns.
 */
function validateAgainstJsonSchema(
  value: unknown,
  schema: WordPressJsonSchema,
): JsonSchemaValidationError[] {
  const errors: JsonSchemaValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  // Handle object schemas (most common for WordPress create/update)
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null) {
      errors.push({
        message: `Expected object, received ${typeof value}`,
        path: [],
      });
      return errors;
    }

    const obj = value as Record<string, unknown>;
    const properties = schema.properties as Record<string, WordPressJsonSchema> | undefined;
    const required = schema.required as string[] | undefined;

    // Check required fields
    if (required && Array.isArray(required)) {
      for (const key of required) {
        if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
          errors.push({
            message: `Required field`,
            path: [{ key }],
          });
        }
      }
    }

    // Validate properties
    if (properties && typeof properties === 'object') {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in obj && obj[key] !== undefined) {
          const propErrors = validateProperty(obj[key], propSchema, [{ key }]);
          errors.push(...propErrors);
        }
      }
    }
  }

  return errors;
}

/**
 * Validates a single property against its schema.
 */
function validateProperty(
  value: unknown,
  schema: WordPressJsonSchema,
  path: Array<string | number | { key: string | number }>,
): JsonSchemaValidationError[] {
  const errors: JsonSchemaValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  // Type validation
  if (schema.type) {
    const typeError = validateType(value, schema.type as string, path);
    if (typeError) {
      errors.push(typeError);
      return errors; // Stop on type error
    }
  }

  // Enum validation
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push({
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        path,
      });
    }
  }

  // Nested object validation
  if (schema.type === 'object' && schema.properties) {
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const required = schema.required as string[] | undefined;

      if (required && Array.isArray(required)) {
        for (const key of required) {
          if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
            errors.push({
              message: `Required field`,
              path: [...path, { key }],
            });
          }
        }
      }

      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj && obj[key] !== undefined) {
          const propErrors = validateProperty(obj[key], propSchema, [...path, { key }]);
          errors.push(...propErrors);
        }
      }
    }
  }

  // Array validation
  if (schema.type === 'array' && schema.items && typeof value === 'object' && Array.isArray(value)) {
    const itemsSchema = schema.items as WordPressJsonSchema;
    for (let i = 0; i < value.length; i++) {
      const itemErrors = validateProperty(value[i], itemsSchema, [...path, i]);
      errors.push(...itemErrors);
    }
  }

  return errors;
}

/**
 * Validates a value against a specific JSON Schema type.
 */
function validateType(
  value: unknown,
  expectedType: string,
  path: Array<string | number | { key: string | number }>,
): JsonSchemaValidationError | null {
  const actualType = getJsonType(value);

  // Handle type arrays (e.g., ["string", "null"])
  const types = expectedType.includes(',') || Array.isArray(expectedType)
    ? (Array.isArray(expectedType) ? expectedType : expectedType.split(',').map(t => t.trim()))
    : [expectedType];

  if (types.includes(actualType) || (types.includes('null') && value === null)) {
    return null;
  }

  // Special case: WordPress sometimes uses "integer" for whole numbers
  if (types.includes('integer') && actualType === 'number' && Number.isInteger(value)) {
    return null;
  }

  return {
    message: `Expected ${types.join(' or ')}, received ${actualType}`,
    path,
  };
}

/**
 * Gets the JSON Schema type of a value.
 */
function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

/**
 * Cache for discovery results per client instance.
 */
interface DiscoveryCache {
  catalog?: WordPressDiscoveryCatalog;
  resources: Map<string, WordPressResourceDescription>;
  terms: Map<string, WordPressResourceDescription>;
  abilities: Map<string, WordPressAbilityDescription>;
}

/**
 * Creates an empty discovery cache.
 */
function createDiscoveryCache(): DiscoveryCache {
  return {
    resources: new Map(),
    terms: new Map(),
    abilities: new Map(),
  };
}

/**
 * Fetches and parses OPTIONS response from a REST endpoint.
 */
async function fetchEndpointSchema(
  runtime: WordPressRuntime,
  endpoint: string,
): Promise<WordPressEndpointSchema | undefined> {
  try {
    const result = await runtime.request<WordPressEndpointSchema>({
      endpoint,
      method: 'OPTIONS',
    });

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
  // Step 1: Get post type info from /types endpoint
  const types = await runtime.fetchAPI<WordPressTypesResponse>('/wp-json/wp/v2/types', undefined, options);

  let typeInfo: { slug: string; rest_base?: string; rest_namespace?: string } | undefined;

  for (const [slug, info] of Object.entries(types)) {
    if (info.rest_base === resource) {
      typeInfo = { slug, rest_base: info.rest_base, rest_namespace: info.rest_namespace };
      break;
    }
  }

  if (!typeInfo) {
    throw new Error(`Content resource '${resource}' not found in WordPress types`);
  }

  const namespace = typeInfo.rest_namespace || 'wp/v2';
  const restBase = typeInfo.rest_base || resource;
  const route = `/wp-json/${namespace}/${restBase}`;

  // Step 2: Get OPTIONS from the collection endpoint
  const endpointSchema = await fetchEndpointSchema(
    runtime,
    route,
  );

  if (!endpointSchema) {
    throw new Error(`Failed to fetch schema for content resource '${resource}'`);
  }

  // Step 3: Build schema set
  const itemSchema = endpointSchema.schema;
  const collectionSchema = itemSchema
    ? { type: 'array', items: itemSchema }
    : undefined;
  const createSchema = buildCreateSchema(endpointSchema);
  const updateSchema = buildUpdateSchema(createSchema);

  return {
    kind: 'content',
    resource,
    slug: typeInfo.slug,
    restBase,
    namespace,
    route,
    schemas: {
      item: itemSchema,
      collection: collectionSchema,
      create: createSchema,
      update: updateSchema,
    },
    raw: endpointSchema,
  };
}

/**
 * Discovers schema for a term resource (taxonomy).
 */
async function discoverTermResource(
  runtime: WordPressRuntime,
  resource: string,
  options?: WordPressRequestOverrides,
): Promise<WordPressResourceDescription> {
  // Step 1: Get taxonomy info from /taxonomies endpoint
  const taxonomies = await runtime.fetchAPI<WordPressTaxonomiesResponse>('/wp-json/wp/v2/taxonomies', undefined, options);

  let taxonomyInfo: { slug: string; rest_base?: string; rest_namespace?: string } | undefined;

  for (const [slug, info] of Object.entries(taxonomies)) {
    if (info.rest_base === resource) {
      taxonomyInfo = { slug, rest_base: info.rest_base, rest_namespace: info.rest_namespace };
      break;
    }
  }

  if (!taxonomyInfo) {
    throw new Error(`Term resource '${resource}' not found in WordPress taxonomies`);
  }

  const namespace = taxonomyInfo.rest_namespace || 'wp/v2';
  const restBase = taxonomyInfo.rest_base || resource;
  const route = `/wp-json/${namespace}/${restBase}`;

  // Step 2: Get OPTIONS from the collection endpoint
  const endpointSchema = await fetchEndpointSchema(
    runtime,
    route,
  );

  if (!endpointSchema) {
    throw new Error(`Failed to fetch schema for term resource '${resource}'`);
  }

  // Step 3: Build schema set
  const itemSchema = endpointSchema.schema;
  const collectionSchema = itemSchema
    ? { type: 'array', items: itemSchema }
    : undefined;
  const createSchema = buildCreateSchema(endpointSchema);
  const updateSchema = buildUpdateSchema(createSchema);

  return {
    kind: 'term',
    resource,
    slug: taxonomyInfo.slug,
    restBase,
    namespace,
    route,
    schemas: {
      item: itemSchema,
      collection: collectionSchema,
      create: createSchema,
      update: updateSchema,
    },
    raw: endpointSchema,
  };
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
  );

  if (!endpointSchema) {
    throw new Error(`Failed to fetch schema for resource '${resource}'`);
  }

  const itemSchema = endpointSchema.schema;
  const collectionSchema = itemSchema
    ? { type: 'array', items: itemSchema }
    : undefined;
  const createSchema = buildCreateSchema(endpointSchema);
  const updateSchema = buildUpdateSchema(createSchema);

  return {
    kind: 'resource',
    resource,
    restBase,
    namespace,
    route,
    schemas: {
      item: itemSchema,
      collection: collectionSchema,
      create: createSchema,
      update: updateSchema,
    },
    raw: endpointSchema,
  };
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

  const schemas: WordPressAbilitySchemaSet = {};

  if (ability.input_schema) {
    schemas.input = ability.input_schema as WordPressAbilityDescription['schemas']['input'];
  }

  if (ability.output_schema) {
    schemas.output = ability.output_schema as WordPressAbilityDescription['schemas']['output'];
  }

  return {
    kind: 'ability',
    name,
    route,
    schemas,
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

    for (const [slug, info] of Object.entries(types)) {
      if (!info.rest_base) {
        continue;
      }

      try {
        const description = await discoverContentResource(
          runtime,
          info.rest_base,
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

    for (const [slug, info] of Object.entries(taxonomies)) {
      if (!info.rest_base) {
        continue;
      }

      try {
        const description = await discoverTermResource(
          runtime,
          info.rest_base,
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

  /**
   * Describes a content resource (post type) schema.
   */
  async function describeContent(
    resource: string,
    options?: WordPressRequestOverrides,
  ): Promise<WordPressResourceDescription> {
    const cacheKey = resource;

    if (cache.resources.has(cacheKey)) {
      return cache.resources.get(cacheKey)!;
    }

    const description = await discoverContentResource(runtime, resource, options);
    cache.resources.set(cacheKey, description);

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

    // Return cached catalog if available and not refreshing
    if (!refresh && cache.catalog) {
      return filterCatalog(cache.catalog, include);
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
    }

    // Discover term resources
    if (includeKinds.includes('terms')) {
      const { resources, warnings } = await discoverAllTerms(runtime, requestOptions);
      catalog.terms = resources;
      catalog.warnings!.push(...warnings);
    }

    // Discover first-class resources
    if (includeKinds.includes('resources')) {
      const { resources, warnings } = await discoverFirstClassResources(runtime, requestOptions);
      catalog.resources = resources;
      catalog.warnings!.push(...warnings);
    }

    // Discover abilities
    if (includeKinds.includes('abilities')) {
      const { abilities, warnings } = await discoverAllAbilities(runtime, requestOptions);
      catalog.abilities = abilities;
      catalog.warnings!.push(...warnings);
    }

    // Cache the full catalog
    cache.catalog = catalog;

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
    cache.resources.clear();
    cache.terms.clear();
    cache.abilities.clear();
  }

  return {
    describeContent,
    describeTerm,
    describeAbility,
    explore,
    clearCache,
  };
}

/**
 * Type for discovery methods returned by createDiscoveryMethods.
 */
export type DiscoveryMethods = ReturnType<typeof createDiscoveryMethods>;
