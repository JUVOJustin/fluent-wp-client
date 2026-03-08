import { z } from 'zod';
import type { WordPressRequestOptions, WordPressRequestResult } from './client-types.js';
import { type WordPressAbility, type WordPressAbilityCategory } from './schemas.js';
import { type WordPressStandardSchema } from './validation.js';
/**
 * Input wrapper for executing one read-only WordPress ability via GET.
 */
export declare const getAbilityInputSchema: z.ZodObject<{
    name: z.ZodString;
    input: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    input?: unknown;
}, {
    name: string;
    input?: unknown;
}>;
/**
 * Input wrapper for executing one regular WordPress ability via POST.
 */
export declare const runAbilityInputSchema: z.ZodObject<{
    name: z.ZodString;
    input: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    input?: unknown;
}, {
    name: string;
    input?: unknown;
}>;
/**
 * Input wrapper for executing one destructive WordPress ability via DELETE.
 */
export declare const deleteAbilityInputSchema: z.ZodObject<{
    name: z.ZodString;
    input: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    input?: unknown;
}, {
    name: string;
    input?: unknown;
}>;
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
 * Fluent executor for one registered WordPress ability.
 */
export declare class WordPressAbilityBuilder<TInput = unknown, TOutput = unknown> {
    private readonly runtime;
    private readonly abilityName;
    private readonly inputValidator?;
    private readonly outputValidator?;
    constructor(runtime: WordPressAbilityRuntime, abilityName: string, inputValidator?: WordPressStandardSchema<TInput> | undefined, outputValidator?: WordPressStandardSchema<TOutput> | undefined);
    /**
     * Adds local validation for the ability input payload.
     */
    inputSchema<TNextInput>(schema: WordPressStandardSchema<TNextInput>): WordPressAbilityBuilder<TNextInput, TOutput>;
    /**
     * Adds local validation for the ability output payload.
     */
    outputSchema<TNextOutput>(schema: WordPressStandardSchema<TNextOutput>): WordPressAbilityBuilder<TInput, TNextOutput>;
    /**
     * Fetches metadata for the configured ability.
     */
    getDefinition(): Promise<WordPressAbility>;
    /**
     * Executes the configured ability through `GET /run`.
     */
    get(input?: TInput): Promise<TOutput>;
    /**
     * Executes the configured ability through `POST /run`.
     */
    run(input?: TInput): Promise<TOutput>;
    /**
     * Executes the configured ability through `DELETE /run`.
     */
    delete(input?: TInput): Promise<TOutput>;
}
/**
 * Creates the WordPress abilities method group used by the main client.
 */
export declare function createAbilityMethods(runtime: WordPressAbilityRuntime): {
    getAbilities: () => Promise<WordPressAbility[]>;
    getAbility: (name: string) => Promise<WordPressAbility>;
    getAbilityCategories: () => Promise<WordPressAbilityCategory[]>;
    getAbilityCategory: (slug: string) => Promise<WordPressAbilityCategory>;
    executeGetAbility: <TOutput = unknown>(name: string, input?: unknown, responseSchema?: WordPressStandardSchema<TOutput>) => Promise<TOutput>;
    executeRunAbility: <TOutput = unknown>(name: string, input?: unknown, responseSchema?: WordPressStandardSchema<TOutput>) => Promise<TOutput>;
    executeDeleteAbility: <TOutput = unknown>(name: string, input?: unknown, responseSchema?: WordPressStandardSchema<TOutput>) => Promise<TOutput>;
    ability: <TInput = unknown, TOutput = unknown>(name: string) => WordPressAbilityBuilder<TInput, TOutput>;
};
