import { z } from 'zod';
import type { WordPressRequestOptions, WordPressRequestResult } from './client-types.js';
import { throwIfWordPressError } from './core/errors.js';
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

const ABILITIES_BASE_ENDPOINT = '/wp-json/wp-abilities/v1';
const abilitiesSchema = z.array(abilitySchema);
const abilityCategoriesSchema = z.array(abilityCategorySchema);

/**
 * Input wrapper for executing one read-only WordPress ability via GET.
 */
export const getAbilityInputSchema = z.object({
  name: z.string().trim().min(1),
  input: z.unknown().optional(),
});

/**
 * Input wrapper for executing one regular WordPress ability via POST.
 */
export const runAbilityInputSchema = z.object({
  name: z.string().trim().min(1),
  input: z.unknown().optional(),
});

/**
 * Input wrapper for executing one destructive WordPress ability via DELETE.
 */
export const deleteAbilityInputSchema = z.object({
  name: z.string().trim().min(1),
  input: z.unknown().optional(),
});

export type GetAbilityInput = z.infer<typeof getAbilityInputSchema>;
export type RunAbilityInput = z.infer<typeof runAbilityInputSchema>;
export type DeleteAbilityInput = z.infer<typeof deleteAbilityInputSchema>;

/**
 * Runtime hooks required for WordPress abilities support.
 */
export interface WordPressAbilityRuntime {
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>;
  request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
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
function createAbilityQueryParams(input: unknown): Record<string, string> | undefined {
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
 * Fluent executor for one registered WordPress ability.
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
  async getDefinition(): Promise<WordPressAbility> {
    const ability = await this.runtime.fetchAPI<WordPressAbility>(createAbilityEndpoint(this.abilityName));
    return abilitySchema.parse(ability);
  }

  /**
   * Executes the configured ability through `GET /run`.
   */
  async get(input?: TInput): Promise<TOutput> {
    const validatedInput = await validateAbilityInput(this.inputValidator, input);
    const { data, response } = await this.runtime.request<unknown>({
      endpoint: createAbilityRunEndpoint(this.abilityName),
      method: 'GET',
      params: createAbilityQueryParams(validatedInput),
    });

    return parseAbilityResponse(response, data, this.outputValidator);
  }

  /**
   * Executes the configured ability through `POST /run`.
   */
  async run(input?: TInput): Promise<TOutput> {
    const validatedInput = await validateAbilityInput(this.inputValidator, input);
    const { data, response } = await this.runtime.request<unknown>({
      endpoint: createAbilityRunEndpoint(this.abilityName),
      method: 'POST',
      body: createAbilityRequestBody(validatedInput),
    });

    return parseAbilityResponse(response, data, this.outputValidator);
  }

  /**
   * Executes the configured ability through `DELETE /run`.
   */
  async delete(input?: TInput): Promise<TOutput> {
    const validatedInput = await validateAbilityInput(this.inputValidator, input);
    const { data, response } = await this.runtime.request<unknown>({
      endpoint: createAbilityRunEndpoint(this.abilityName),
      method: 'DELETE',
      params: createAbilityQueryParams(validatedInput),
    });

    return parseAbilityResponse(response, data, this.outputValidator);
  }
}

/**
 * Creates the WordPress abilities method group used by the main client.
 */
export function createAbilityMethods(runtime: WordPressAbilityRuntime) {
  /**
   * Lists all registered abilities exposed to the current caller.
   */
  async function getAbilities(): Promise<WordPressAbility[]> {
    const abilities = await runtime.fetchAPI<WordPressAbility[]>(`${ABILITIES_BASE_ENDPOINT}/abilities`);
    return abilitiesSchema.parse(abilities);
  }

  /**
   * Fetches metadata for one registered ability.
   */
  async function getAbility(name: string): Promise<WordPressAbility> {
    const ability = await runtime.fetchAPI<WordPressAbility>(createAbilityEndpoint(name));
    return abilitySchema.parse(ability);
  }

  /**
   * Lists all ability categories exposed to the current caller.
   */
  async function getAbilityCategories(): Promise<WordPressAbilityCategory[]> {
    const categories = await runtime.fetchAPI<WordPressAbilityCategory[]>(`${ABILITIES_BASE_ENDPOINT}/categories`);
    return abilityCategoriesSchema.parse(categories);
  }

  /**
   * Fetches one ability category by slug.
   */
  async function getAbilityCategory(slug: string): Promise<WordPressAbilityCategory> {
    const category = await runtime.fetchAPI<WordPressAbilityCategory>(`${ABILITIES_BASE_ENDPOINT}/categories/${slug}`);
    return abilityCategorySchema.parse(category);
  }

  /**
   * Executes one read-only ability through `GET /run`.
   */
  async function executeGetAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
  ): Promise<TOutput> {
    return new WordPressAbilityBuilder<unknown, TOutput>(runtime, name, undefined, responseSchema).get(input);
  }

  /**
   * Executes one regular ability through `POST /run`.
   */
  async function executeRunAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
  ): Promise<TOutput> {
    return new WordPressAbilityBuilder<unknown, TOutput>(runtime, name, undefined, responseSchema).run(input);
  }

  /**
   * Executes one destructive ability through `DELETE /run`.
   */
  async function executeDeleteAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    responseSchema?: WordPressStandardSchema<TOutput>,
  ): Promise<TOutput> {
    return new WordPressAbilityBuilder<unknown, TOutput>(runtime, name, undefined, responseSchema).delete(input);
  }

  /**
   * Starts one fluent ability execution builder for a registered ability.
   */
  function ability<TInput = unknown, TOutput = unknown>(name: string): WordPressAbilityBuilder<TInput, TOutput> {
    return new WordPressAbilityBuilder<TInput, TOutput>(runtime, name);
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
