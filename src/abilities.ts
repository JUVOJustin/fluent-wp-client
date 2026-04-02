import { z } from 'zod';
import type { WordPressRequestOptions, WordPressRequestResult } from './types/client.js';
import type { WordPressRequestOverrides } from './types/resources.js';
import type { WordPressAbilityDescription, WordPressJsonSchema } from './types/discovery.js';
import { throwIfWordPressError } from './core/errors.js';
import { applyRequestOverrides } from './core/request-overrides.js';
import {
  abilityCategorySchema,
  abilitySchema,
  type WordPressAbility,
  type WordPressAbilityCategory,
} from './schemas.js';
import {
  validateWithStandardSchema,
  type WordPressStandardSchema,
} from './core/validation.js';
import type { SerializedQueryParams } from './types/resources.js';

const ABILITIES_BASE_ENDPOINT = '/wp-json/wp-abilities/v1';
const zodAbilitiesSchema = z.array(abilitySchema);
const zodAbilityCategoriesSchema = z.array(abilityCategorySchema);

/**
 * Input wrapper for executing one read-only WordPress ability via GET.
 */
export const zodGetAbilityInputSchema = z.object({
  name: z.string().trim().min(1),
  input: z.unknown().optional(),
});

/**
 * Input wrapper for executing one regular WordPress ability via POST.
 */
export const zodRunAbilityInputSchema = z.object({
  name: z.string().trim().min(1),
  input: z.unknown().optional(),
});

/**
 * Input wrapper for executing one destructive WordPress ability via DELETE.
 */
export const zodDeleteAbilityInputSchema = z.object({
  name: z.string().trim().min(1),
  input: z.unknown().optional(),
});

export type GetAbilityInput = z.infer<typeof zodGetAbilityInputSchema>;
export type RunAbilityInput = z.infer<typeof zodRunAbilityInputSchema>;
export type DeleteAbilityInput = z.infer<typeof zodDeleteAbilityInputSchema>;

/**
 * Runtime hooks required for WordPress abilities support.
 */
export interface WordPressAbilityRuntime {
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>;
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
  /**
   * Resolves an ability description from the discovery cache when available.
   * When the catalog has been seeded via `useCatalog()` or populated by
   * `explore()`, this returns immediately without a network round-trip.
   */
  describeAbility?: (name: string, options?: WordPressRequestOverrides) => Promise<WordPressAbilityDescription>;
}

/**
 * Normalizes one ability name to the `namespace/ability` route shape.
 */
function normalizeAbilityName(name: string): string {
  const normalizedName = name.trim().replace(/^\/+|\/+$/g, '');

  if (!normalizedName) {
    throw new Error('WordPress ability name must not be empty.');
  }

  if (!normalizedName.includes('/')) {
    throw new Error(`WordPress ability '${name}' must use 'namespace/ability' format.`);
  }

  return normalizedName;
}

/**
 * Builds the metadata endpoint for one registered ability.
 */
function createAbilityEndpoint(name: string): string {
  return `${ABILITIES_BASE_ENDPOINT}/abilities/${normalizeAbilityName(name)}`;
}

/**
 * Builds the executable `/run` endpoint for one registered ability.
 */
function createAbilityRunEndpoint(name: string): string {
  return `${createAbilityEndpoint(name)}/run`;
}

/**
 * Serializes optional ability input for GET and DELETE requests.
 */
function createAbilityQueryParams(input: unknown): SerializedQueryParams | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return {
      input: 'null',
    };
  }

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return {
      input: String(input),
    };
  }

  throw new Error(
    'WordPress GET and DELETE ability execution only supports primitive input values. Use POST-based run() for object or array input.',
  );
}

/**
 * Serializes optional ability input for POST requests.
 */
function createAbilityRequestBody(input: unknown): { input: unknown } | undefined {
  if (input === undefined) {
    return undefined;
  }

  return { input };
}

/**
 * Converts a discovered JSON Schema to a Standard Schema validator via Zod.
 * Returns undefined when the JSON Schema is missing or conversion fails.
 */
function jsonSchemaToValidator<T>(schema: WordPressJsonSchema | undefined): WordPressStandardSchema<T> | undefined {
  if (!schema) {
    return undefined;
  }

  try {
    return z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]) as unknown as WordPressStandardSchema<T>;
  } catch {
    return undefined;
  }
}

/**
 * Validates one optional ability input payload before the request runs.
 */
async function validateAbilityInput<TInput>(
  schema: WordPressStandardSchema<TInput> | undefined,
  input: TInput | undefined,
): Promise<TInput | undefined> {
  if (!schema) {
    return input;
  }

  return validateWithStandardSchema(
    schema,
    input,
    'WordPress ability input validation failed',
  );
}

/**
 * Parses one ability execution response and applies optional output validation.
 */
async function parseAbilityResponse<TOutput>(
  response: Response,
  data: unknown,
  responseSchema?: WordPressStandardSchema<TOutput>,
): Promise<TOutput> {
  throwIfWordPressError(response, data);

  if (!responseSchema) {
    return data as TOutput;
  }

  return validateWithStandardSchema(
    responseSchema,
    data,
    'WordPress ability response validation failed',
  );
}

/**
 * Validates one ability metadata payload with a schema.
 */
async function parseAbilityMetadata<TOutput>(
  schema: WordPressStandardSchema<TOutput>,
  payload: unknown,
): Promise<TOutput> {
  return validateWithStandardSchema(
    schema,
    payload,
    'WordPress ability metadata validation failed',
  );
}

/**
 * Resolves the effective input and output validators for an ability execution.
 *
 * Priority:
 * 1. Explicit validators from `.inputSchema()` / `.outputSchema()` always win
 * 2. Discovered schemas from the catalog (converted via `z.fromJSONSchema()`)
 * 3. No validation (passthrough)
 */
async function resolveAbilityValidators<TInput, TOutput>(
  runtime: WordPressAbilityRuntime,
  abilityName: string,
  explicitInput: WordPressStandardSchema<TInput> | undefined,
  explicitOutput: WordPressStandardSchema<TOutput> | undefined,
): Promise<{
  inputValidator: WordPressStandardSchema<TInput> | undefined;
  outputValidator: WordPressStandardSchema<TOutput> | undefined;
}> {
  // Both explicitly provided — skip discovery entirely
  if (explicitInput && explicitOutput) {
    return { inputValidator: explicitInput, outputValidator: explicitOutput };
  }

  // No discovery method available — use whatever was provided
  if (!runtime.describeAbility) {
    return { inputValidator: explicitInput, outputValidator: explicitOutput };
  }

  // Attempt to resolve from the discovery cache (no-op if not cached)
  let description: WordPressAbilityDescription | undefined;

  try {
    description = await runtime.describeAbility(abilityName);
  } catch {
    // Discovery failed (network error, ability not found, etc.)
    return { inputValidator: explicitInput, outputValidator: explicitOutput };
  }

  return {
    inputValidator: explicitInput ?? jsonSchemaToValidator<TInput>(description.schemas.input),
    outputValidator: explicitOutput ?? jsonSchemaToValidator<TOutput>(description.schemas.output),
  };
}

/**
 * Fluent executor for one registered WordPress ability.
 *
 * When a catalog is seeded via `useCatalog()` or populated by `explore()`,
 * the builder auto-applies discovered input and output schemas without
 * explicit `.inputSchema()` / `.outputSchema()` calls. Explicit schemas
 * always take priority over discovered ones.
 */
export class WordPressAbilityBuilder<TInput = unknown, TOutput = unknown> {
  constructor(
    private readonly runtime: WordPressAbilityRuntime,
    private readonly abilityName: string,
    private readonly inputValidator?: WordPressStandardSchema<TInput>,
    private readonly outputValidator?: WordPressStandardSchema<TOutput>,
  ) {}

  /**
   * Adds local validation for the ability input payload.
   * Takes priority over any discovered schema from the catalog.
   */
  inputSchema<TNextInput>(schema: WordPressStandardSchema<TNextInput>): WordPressAbilityBuilder<TNextInput, TOutput> {
    return new WordPressAbilityBuilder<TNextInput, TOutput>(
      this.runtime,
      this.abilityName,
      schema,
      this.outputValidator as WordPressStandardSchema<TOutput> | undefined,
    );
  }

  /**
   * Adds local validation for the ability output payload.
   * Takes priority over any discovered schema from the catalog.
   */
  outputSchema<TNextOutput>(schema: WordPressStandardSchema<TNextOutput>): WordPressAbilityBuilder<TInput, TNextOutput> {
    return new WordPressAbilityBuilder<TInput, TNextOutput>(
      this.runtime,
      this.abilityName,
      this.inputValidator as WordPressStandardSchema<TInput> | undefined,
      schema,
    );
  }

  /**
   * Fetches metadata for the configured ability.
   */
  async getDefinition(requestOptions?: WordPressRequestOverrides): Promise<WordPressAbility> {
    const ability = await this.runtime.fetchAPI<WordPressAbility>(
      createAbilityEndpoint(this.abilityName),
      undefined,
      requestOptions,
    );
    return parseAbilityMetadata(abilitySchema, ability);
  }

  /**
   * Executes the configured ability through `GET /run`.
   */
  async get(input?: TInput, requestOptions?: WordPressRequestOverrides): Promise<TOutput> {
    const { inputValidator, outputValidator } = await resolveAbilityValidators(
      this.runtime, this.abilityName, this.inputValidator, this.outputValidator,
    );

    const validatedInput = await validateAbilityInput(inputValidator, input);
    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: createAbilityRunEndpoint(this.abilityName),
      method: 'GET',
      params: createAbilityQueryParams(validatedInput),
    }, requestOptions));

    return parseAbilityResponse(response, data, outputValidator);
  }

  /**
   * Executes the configured ability through `POST /run`.
   */
  async run(input?: TInput, requestOptions?: WordPressRequestOverrides): Promise<TOutput> {
    const { inputValidator, outputValidator } = await resolveAbilityValidators(
      this.runtime, this.abilityName, this.inputValidator, this.outputValidator,
    );

    const validatedInput = await validateAbilityInput(inputValidator, input);
    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: createAbilityRunEndpoint(this.abilityName),
      method: 'POST',
      body: createAbilityRequestBody(validatedInput),
    }, requestOptions));

    return parseAbilityResponse(response, data, outputValidator);
  }

  /**
   * Executes the configured ability through `DELETE /run`.
   */
  async delete(input?: TInput, requestOptions?: WordPressRequestOverrides): Promise<TOutput> {
    const { inputValidator, outputValidator } = await resolveAbilityValidators(
      this.runtime, this.abilityName, this.inputValidator, this.outputValidator,
    );

    const validatedInput = await validateAbilityInput(inputValidator, input);
    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: createAbilityRunEndpoint(this.abilityName),
      method: 'DELETE',
      params: createAbilityQueryParams(validatedInput),
    }, requestOptions));

    return parseAbilityResponse(response, data, outputValidator);
  }

  /**
   * Returns a JSON Schema descriptor for this ability.
   *
   * Routes through the discovery cache when available so a pre-seeded
   * catalog via `useCatalog()` avoids a network round-trip.
   */
  async describe(requestOptions?: WordPressRequestOverrides): Promise<WordPressAbilityDescription> {
    // Use the discovery cache when available
    if (this.runtime.describeAbility) {
      return this.runtime.describeAbility(this.abilityName, requestOptions);
    }

    // Fallback: direct fetch
    const ability = await this.runtime.fetchAPI<WordPressAbility>(
      createAbilityEndpoint(this.abilityName),
      undefined,
      requestOptions,
    );

    const schemas: WordPressAbilityDescription['schemas'] = {};

    if (ability.input_schema) {
      schemas.input = ability.input_schema as WordPressAbilityDescription['schemas']['input'];
    }

    if (ability.output_schema) {
      schemas.output = ability.output_schema as WordPressAbilityDescription['schemas']['output'];
    }

    return {
      kind: 'ability',
      name: this.abilityName,
      route: createAbilityEndpoint(this.abilityName),
      schemas,
      annotations: ability.meta?.annotations || {},
      raw: ability,
    };
  }
}

/**
 * Creates the WordPress abilities method group used by the main client.
 */
export function createAbilityMethods(runtime: WordPressAbilityRuntime) {
  /**
   * Starts one fluent ability execution builder for a registered ability.
   */
  function ability<TInput = unknown, TOutput = unknown>(name: string): WordPressAbilityBuilder<TInput, TOutput> {
    return new WordPressAbilityBuilder<TInput, TOutput>(runtime, name);
  }

  /**
   * Fetches one ability metadata payload and validates it with the provided schema.
   */
  async function fetchAbilityMetadata<TOutput>(
    endpoint: string,
    schema: WordPressStandardSchema<TOutput>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    const payload = await runtime.fetchAPI<TOutput>(endpoint, undefined, requestOptions);
    return parseAbilityMetadata(schema, payload);
  }

  /**
   * Creates one fluent ability builder with optional output validation.
   */
  function createConfiguredAbility<TOutput = unknown>(
    name: string,
    responseSchema?: WordPressStandardSchema<TOutput>,
  ): WordPressAbilityBuilder<unknown, TOutput> {
    if (!responseSchema) {
      return ability<unknown, TOutput>(name);
    }

    return ability<unknown, TOutput>(name).outputSchema(responseSchema);
  }

  /**
   * Lists all registered abilities exposed to the current caller.
   */
  async function getAbilities(requestOptions?: WordPressRequestOverrides): Promise<WordPressAbility[]> {
    return fetchAbilityMetadata(`${ABILITIES_BASE_ENDPOINT}/abilities`, zodAbilitiesSchema, requestOptions);
  }

  /**
   * Fetches metadata for one registered ability.
   */
  async function getAbility(name: string, requestOptions?: WordPressRequestOverrides): Promise<WordPressAbility> {
    return fetchAbilityMetadata(createAbilityEndpoint(name), abilitySchema, requestOptions);
  }

  /**
   * Lists all ability categories exposed to the current caller.
   */
  async function getAbilityCategories(requestOptions?: WordPressRequestOverrides): Promise<WordPressAbilityCategory[]> {
    return fetchAbilityMetadata(`${ABILITIES_BASE_ENDPOINT}/categories`, zodAbilityCategoriesSchema, requestOptions);
  }

  /**
   * Fetches one ability category by slug.
   */
  async function getAbilityCategory(
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbilityCategory> {
    return fetchAbilityMetadata(
      `${ABILITIES_BASE_ENDPOINT}/categories/${slug}`,
      abilityCategorySchema,
      requestOptions,
    );
  }

  /**
   * Executes one read-only ability through `GET /run`.
   */
  async function executeGetAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return createConfiguredAbility(name, responseSchema).get(input, requestOptions);
  }

  /**
   * Executes one regular ability through `POST /run`.
   */
  async function executeRunAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return createConfiguredAbility(name, responseSchema).run(input, requestOptions);
  }

  /**
   * Executes one destructive ability through `DELETE /run`.
   */
  async function executeDeleteAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return createConfiguredAbility(name, responseSchema).delete(input, requestOptions);
  }

  return {
    getAbilities,
    getAbility,
    getAbilityCategories,
    getAbilityCategory,
    executeGetAbility,
    executeRunAbility,
    executeDeleteAbility,
    ability,
  };
}
