import { z } from "zod";
import { createInvalidRequestError } from "./core/errors.js";
import { applyRequestOverrides } from "./core/request-overrides.js";
import type { WordPressStandardSchema } from "./core/validation.js";
import {
  abilityAnnotationsSchema,
  abilityCategorySchema,
  abilitySchema,
  type WordPressAbility,
  type WordPressAbilityCategory,
} from "./schemas.js";
import type {
  WordPressRequestOptions,
  WordPressRequestResult,
} from "./types/client.js";
import type {
  WordPressAbilityDescription,
  WordPressAbilitySchemaSet,
  WordPressJsonSchema,
} from "./types/discovery.js";
import type {
  SerializedQueryParams,
  WordPressRequestOverrides,
} from "./types/resources.js";
import { zodFromJsonSchema } from "./zod-helpers.js";

const ABILITIES_BASE_ENDPOINT = "/wp-json/wp-abilities/v1";

const zodAbilityExecutionInputSchema = z.object({
  input: z.unknown().optional(),
  name: z.string().trim().min(1),
});

/**
 * Input wrapper for executing one read-only WordPress ability via GET.
 */
export const zodGetAbilityInputSchema = zodAbilityExecutionInputSchema;

/**
 * Input wrapper for executing one regular WordPress ability via POST.
 */
export const zodRunAbilityInputSchema = zodGetAbilityInputSchema;

/**
 * Input wrapper for executing one destructive WordPress ability via DELETE.
 */
export const zodDeleteAbilityInputSchema = zodGetAbilityInputSchema;

export type GetAbilityInput = z.infer<typeof zodGetAbilityInputSchema>;
export type RunAbilityInput = z.infer<typeof zodRunAbilityInputSchema>;
export type DeleteAbilityInput = z.infer<typeof zodDeleteAbilityInputSchema>;
export type WordPressAbilitySchemaName =
  | keyof WordPressAbilitySchemaSet
  | "annotations"
  | "category"
  | "definition";

export interface WordPressAbilitySchemaClient {
  getJsonSchema: (
    schema: WordPressAbilitySchemaName,
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressJsonSchema>;
  getStandardSchema: (
    schema: WordPressAbilitySchemaName,
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressStandardSchema>;
}

const standardSchemaCache = new WeakMap<
  WordPressJsonSchema,
  WordPressStandardSchema
>();

const fallbackAbilityJsonSchemas = {
  annotations: z.toJSONSchema(abilityAnnotationsSchema),
  category: z.toJSONSchema(abilityCategorySchema),
  definition: z.toJSONSchema(abilitySchema),
} satisfies Record<string, WordPressJsonSchema>;

type WordPressAbilityFallbackSchemaName =
  keyof typeof fallbackAbilityJsonSchemas;

function isFallbackAbilitySchemaName(
  schemaName: WordPressAbilitySchemaName,
): schemaName is WordPressAbilityFallbackSchemaName {
  return schemaName in fallbackAbilityJsonSchemas;
}

function isAbilityDescriptionSchemaName(
  schemaName: WordPressAbilitySchemaName,
): schemaName is keyof WordPressAbilitySchemaSet {
  return schemaName === "input" || schemaName === "output";
}

/**
 * Runtime hooks required for WordPress abilities support.
 */
export interface WordPressAbilityRuntime {
  /**
   * Resolves an ability description from the discovery cache when available.
   * When the catalog has been seeded via `useCatalog()` or populated by
   * `explore()`, this returns immediately without a network round-trip.
   */
  describeAbility?: (
    name: string,
    options?: WordPressRequestOverrides,
  ) => Promise<WordPressAbilityDescription>;
  fetchAPI: <T>(
    endpoint: string,
    params?: SerializedQueryParams,
    options?: WordPressRequestOverrides,
  ) => Promise<T>;
  request: <T = unknown>(
    options: WordPressRequestOptions,
  ) => Promise<WordPressRequestResult<T>>;
}

/**
 * Normalizes one ability name to the `namespace/ability` route shape.
 */
function normalizeAbilityName(name: string): string {
  const normalizedName = name.trim().replace(/^\/+|\/+$/g, "");

  if (!normalizedName) {
    throw createInvalidRequestError(
      "WordPress ability name must not be empty.",
      {
        operation: "ability",
      },
    );
  }

  if (!normalizedName.includes("/")) {
    throw createInvalidRequestError(
      `WordPress ability '${name}' must use 'namespace/ability' format.`,
      { operation: "ability" },
    );
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
function createAbilityQueryParams(
  input: unknown,
): SerializedQueryParams | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return {
      input: "null",
    };
  }

  if (
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return {
      input: String(input),
    };
  }

  throw createInvalidRequestError(
    "WordPress GET and DELETE ability execution only supports primitive input values. Use POST-based run() for object or array input.",
    { operation: "ability" },
  );
}

/**
 * Serializes optional ability input for POST requests.
 */
function createAbilityRequestBody(
  input: unknown,
): { input: unknown } | undefined {
  if (input === undefined) {
    return undefined;
  }

  return { input };
}

function getJsonSchemaFromDescription(
  description: WordPressAbilityDescription,
  schemaName: WordPressAbilitySchemaName,
): WordPressJsonSchema {
  if (isFallbackAbilitySchemaName(schemaName)) {
    return fallbackAbilityJsonSchemas[schemaName];
  }

  if (!isAbilityDescriptionSchemaName(schemaName)) {
    throw createInvalidRequestError(
      `No ${schemaName} JSON Schema is available for ability:${description.name}.`,
    );
  }

  return description.schemas[schemaName] ?? {};
}

function getStandardSchemaFromDescription(
  description: WordPressAbilityDescription,
  schemaName: WordPressAbilitySchemaName,
): WordPressStandardSchema {
  const jsonSchema = getJsonSchemaFromDescription(description, schemaName);
  const cached = standardSchemaCache.get(jsonSchema);
  if (cached) {
    return cached;
  }

  const standardSchema = zodFromJsonSchema(jsonSchema);
  if (!standardSchema) {
    throw createInvalidRequestError(
      `Unable to convert ${schemaName} JSON Schema to Standard Schema for ability:${description.name}.`,
    );
  }

  standardSchemaCache.set(
    jsonSchema,
    standardSchema as WordPressStandardSchema,
  );
  return standardSchema as WordPressStandardSchema;
}

/**
 * Executes one registered WordPress ability.
 *
 * Validation stays upstream in WordPress. Use `.describe()` to fetch the live
 * input/output schemas when you want local validation in application code.
 */
export class WordPressAbilityBuilder<TInput = unknown, TOutput = unknown> {
  constructor(
    private readonly runtime: WordPressAbilityRuntime,
    private readonly abilityName: string,
  ) {}

  /**
   * Fetches metadata for the configured ability.
   */
  async getDefinition(
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbility> {
    return this.runtime.fetchAPI<WordPressAbility>(
      createAbilityEndpoint(this.abilityName),
      undefined,
      requestOptions,
    );
  }

  /**
   * Fetches metadata for the configured ability.
   */
  async definition(
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbility> {
    return this.getDefinition(requestOptions);
  }

  /**
   * Executes the configured ability using its declared execution mode.
   */
  async execute(
    input?: TInput,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    const description = await this.describe(requestOptions);

    if (description.annotations?.readonly === true) {
      return this.get(input, requestOptions);
    }

    if (description.annotations?.destructive === true) {
      return this.delete(input, requestOptions);
    }

    return this.run(input, requestOptions);
  }

  /**
   * Executes the configured ability through `GET /run`.
   */
  async get(
    input?: TInput,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          endpoint: createAbilityRunEndpoint(this.abilityName),
          method: "GET",
          params: createAbilityQueryParams(input),
        },
        requestOptions,
      ),
    );

    return data as TOutput;
  }

  /**
   * Executes the configured ability through `POST /run`.
   */
  async run(
    input?: TInput,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          body: createAbilityRequestBody(input),
          endpoint: createAbilityRunEndpoint(this.abilityName),
          method: "POST",
        },
        requestOptions,
      ),
    );

    return data as TOutput;
  }

  /**
   * Executes the configured ability through `DELETE /run`.
   */
  async delete(
    input?: TInput,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    const { data } = await this.runtime.request<unknown>(
      applyRequestOverrides(
        {
          endpoint: createAbilityRunEndpoint(this.abilityName),
          method: "DELETE",
          params: createAbilityQueryParams(input),
        },
        requestOptions,
      ),
    );

    return data as TOutput;
  }

  async getJsonSchema(
    schema: WordPressAbilitySchemaName,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressJsonSchema> {
    return getJsonSchemaFromDescription(
      await this.describe(requestOptions),
      schema,
    );
  }

  async getStandardSchema(
    schema: WordPressAbilitySchemaName,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressStandardSchema> {
    return getStandardSchemaFromDescription(
      await this.describe(requestOptions),
      schema,
    );
  }

  /**
   * Returns a JSON Schema descriptor for this ability.
   *
   * Routes through the discovery cache when available so a pre-seeded
   * catalog via `useCatalog()` avoids a network round-trip.
   */
  async describe(
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbilityDescription> {
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

    const schemas: WordPressAbilityDescription["schemas"] = {};

    if (ability.input_schema) {
      schemas.input =
        ability.input_schema as WordPressAbilityDescription["schemas"]["input"];
    }

    if (ability.output_schema) {
      schemas.output =
        ability.output_schema as WordPressAbilityDescription["schemas"]["output"];
    }

    return {
      annotations: ability.meta?.annotations || {},
      kind: "ability",
      name: this.abilityName,
      raw: ability,
      route: createAbilityEndpoint(this.abilityName),
      schemas,
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
  function ability<TInput = unknown, TOutput = unknown>(
    name: string,
  ): WordPressAbilityBuilder<TInput, TOutput> {
    return new WordPressAbilityBuilder<TInput, TOutput>(runtime, name);
  }

  /**
   * Lists all registered abilities exposed to the current caller.
   */
  async function getAbilities(
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbility[]> {
    return runtime.fetchAPI<WordPressAbility[]>(
      `${ABILITIES_BASE_ENDPOINT}/abilities`,
      undefined,
      requestOptions,
    );
  }

  /**
   * Fetches metadata for one registered ability.
   */
  async function getAbility(
    name: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbility> {
    return runtime.fetchAPI<WordPressAbility>(
      createAbilityEndpoint(name),
      undefined,
      requestOptions,
    );
  }

  /**
   * Lists all ability categories exposed to the current caller.
   */
  async function getAbilityCategories(
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbilityCategory[]> {
    return runtime.fetchAPI<WordPressAbilityCategory[]>(
      `${ABILITIES_BASE_ENDPOINT}/categories`,
      undefined,
      requestOptions,
    );
  }

  /**
   * Fetches one ability category by slug.
   */
  async function getAbilityCategory(
    slug: string,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<WordPressAbilityCategory> {
    return runtime.fetchAPI<WordPressAbilityCategory>(
      `${ABILITIES_BASE_ENDPOINT}/categories/${slug}`,
      undefined,
      requestOptions,
    );
  }

  /**
   * Executes one read-only ability through `GET /run`.
   */
  async function executeGetAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return ability<unknown, TOutput>(name).get(input, requestOptions);
  }

  /**
   * Executes one regular ability through `POST /run`.
   */
  async function executeRunAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return ability<unknown, TOutput>(name).run(input, requestOptions);
  }

  /**
   * Executes one destructive ability through `DELETE /run`.
   */
  async function executeDeleteAbility<TOutput = unknown>(
    name: string,
    input?: unknown,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TOutput> {
    return ability<unknown, TOutput>(name).delete(input, requestOptions);
  }

  return {
    ability,
    executeDeleteAbility,
    executeGetAbility,
    executeRunAbility,
    getAbilities,
    getAbility,
    getAbilityCategories,
    getAbilityCategory,
  };
}
