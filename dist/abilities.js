import { z } from 'zod';
import { throwIfWordPressError } from './errors.js';
import { abilityCategorySchema, abilitySchema, } from './schemas.js';
import { validateWithStandardSchema, } from './validation.js';
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
/**
 * Normalizes one ability name to the `namespace/ability` route shape.
 */
function normalizeAbilityName(name) {
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
function createAbilityEndpoint(name) {
    return `${ABILITIES_BASE_ENDPOINT}/abilities/${normalizeAbilityName(name)}`;
}
/**
 * Builds the executable `/run` endpoint for one registered ability.
 */
function createAbilityRunEndpoint(name) {
    return `${createAbilityEndpoint(name)}/run`;
}
/**
 * Serializes optional ability input for GET and DELETE requests.
 */
function createAbilityQueryParams(input) {
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
    throw new Error('WordPress GET and DELETE ability execution only supports primitive input values. Use POST-based run() for object or array input.');
}
/**
 * Serializes optional ability input for POST requests.
 */
function createAbilityRequestBody(input) {
    if (input === undefined) {
        return undefined;
    }
    return { input };
}
/**
 * Validates one optional ability input payload before the request runs.
 */
async function validateAbilityInput(schema, input) {
    if (!schema) {
        return input;
    }
    return validateWithStandardSchema(schema, input, 'WordPress ability input validation failed');
}
/**
 * Parses one ability execution response and applies optional output validation.
 */
async function parseAbilityResponse(response, data, responseSchema) {
    throwIfWordPressError(response, data);
    if (!responseSchema) {
        return data;
    }
    return validateWithStandardSchema(responseSchema, data, 'WordPress ability response validation failed');
}
/**
 * Fluent executor for one registered WordPress ability.
 */
export class WordPressAbilityBuilder {
    runtime;
    abilityName;
    inputValidator;
    outputValidator;
    constructor(runtime, abilityName, inputValidator, outputValidator) {
        this.runtime = runtime;
        this.abilityName = abilityName;
        this.inputValidator = inputValidator;
        this.outputValidator = outputValidator;
    }
    /**
     * Adds local validation for the ability input payload.
     */
    inputSchema(schema) {
        return new WordPressAbilityBuilder(this.runtime, this.abilityName, schema, this.outputValidator);
    }
    /**
     * Adds local validation for the ability output payload.
     */
    outputSchema(schema) {
        return new WordPressAbilityBuilder(this.runtime, this.abilityName, this.inputValidator, schema);
    }
    /**
     * Fetches metadata for the configured ability.
     */
    async getDefinition() {
        const ability = await this.runtime.fetchAPI(createAbilityEndpoint(this.abilityName));
        return abilitySchema.parse(ability);
    }
    /**
     * Executes the configured ability through `GET /run`.
     */
    async get(input) {
        const validatedInput = await validateAbilityInput(this.inputValidator, input);
        const { data, response } = await this.runtime.request({
            endpoint: createAbilityRunEndpoint(this.abilityName),
            method: 'GET',
            params: createAbilityQueryParams(validatedInput),
        });
        return parseAbilityResponse(response, data, this.outputValidator);
    }
    /**
     * Executes the configured ability through `POST /run`.
     */
    async run(input) {
        const validatedInput = await validateAbilityInput(this.inputValidator, input);
        const { data, response } = await this.runtime.request({
            endpoint: createAbilityRunEndpoint(this.abilityName),
            method: 'POST',
            body: createAbilityRequestBody(validatedInput),
        });
        return parseAbilityResponse(response, data, this.outputValidator);
    }
    /**
     * Executes the configured ability through `DELETE /run`.
     */
    async delete(input) {
        const validatedInput = await validateAbilityInput(this.inputValidator, input);
        const { data, response } = await this.runtime.request({
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
export function createAbilityMethods(runtime) {
    /**
     * Lists all registered abilities exposed to the current caller.
     */
    async function getAbilities() {
        const abilities = await runtime.fetchAPI(`${ABILITIES_BASE_ENDPOINT}/abilities`);
        return abilitiesSchema.parse(abilities);
    }
    /**
     * Fetches metadata for one registered ability.
     */
    async function getAbility(name) {
        const ability = await runtime.fetchAPI(createAbilityEndpoint(name));
        return abilitySchema.parse(ability);
    }
    /**
     * Lists all ability categories exposed to the current caller.
     */
    async function getAbilityCategories() {
        const categories = await runtime.fetchAPI(`${ABILITIES_BASE_ENDPOINT}/categories`);
        return abilityCategoriesSchema.parse(categories);
    }
    /**
     * Fetches one ability category by slug.
     */
    async function getAbilityCategory(slug) {
        const category = await runtime.fetchAPI(`${ABILITIES_BASE_ENDPOINT}/categories/${slug}`);
        return abilityCategorySchema.parse(category);
    }
    /**
     * Executes one read-only ability through `GET /run`.
     */
    async function executeGetAbility(name, input, responseSchema) {
        return new WordPressAbilityBuilder(runtime, name, undefined, responseSchema).get(input);
    }
    /**
     * Executes one regular ability through `POST /run`.
     */
    async function executeRunAbility(name, input, responseSchema) {
        return new WordPressAbilityBuilder(runtime, name, undefined, responseSchema).run(input);
    }
    /**
     * Executes one destructive ability through `DELETE /run`.
     */
    async function executeDeleteAbility(name, input, responseSchema) {
        return new WordPressAbilityBuilder(runtime, name, undefined, responseSchema).delete(input);
    }
    /**
     * Starts one fluent ability execution builder for a registered ability.
     */
    function ability(name) {
        return new WordPressAbilityBuilder(runtime, name);
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
