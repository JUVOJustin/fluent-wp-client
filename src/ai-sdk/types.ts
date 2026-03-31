import type { WordPressClient } from '../client.js';

/**
 * Shared configuration accepted by all AI SDK tool factories.
 *
 * Developers use these options to tailor tool descriptions, preset default
 * values, and lock arguments that must not change at model runtime.
 */
export interface ToolFactoryOptions<TArgs extends Record<string, unknown>> {
  /** Override the AI-facing tool description. */
  description?: string;
  /** Enable provider strict-mode tool calling when supported. */
  strict?: boolean;
  /** Require approval before executing this tool. */
  needsApproval?: boolean | ((input: TArgs) => boolean | Promise<boolean>);
  /** Default arguments merged underneath model-provided input. */
  defaultArgs?: Partial<TArgs>;
  /** Locked arguments that always override model-provided input. */
  fixedArgs?: Partial<TArgs>;
}

/**
 * Mutation tool options support nested `input` defaults and overrides.
 */
export interface MutationToolFactoryOptions<TArgs extends Record<string, unknown>> extends ToolFactoryOptions<TArgs> {
  /** Default nested input fields merged underneath model-provided input.input. */
  defaultInput?: Record<string, unknown>;
  /** Locked nested input fields that always override model-provided input.input. */
  fixedInput?: Record<string, unknown>;
}

/**
 * Configuration for a generic content or term tool factory.
 *
 * Adds the `resource` string so the factory knows which REST endpoint to target.
 */
export interface GenericResourceToolFactoryOptions<TArgs extends Record<string, unknown>> extends ToolFactoryOptions<TArgs> {
  /** REST base for the custom resource, e.g. `'books'` or `'genre'`. */
  resource: string;
}

/**
 * Generic mutation tool options for custom resources.
 */
export interface GenericMutationToolFactoryOptions<TArgs extends Record<string, unknown>> extends MutationToolFactoryOptions<TArgs> {
  /** REST base for the custom resource. */
  resource: string;
}

/**
 * Internal tool factory runtime that carries a client reference.
 */
export type ToolClient = WordPressClient;
