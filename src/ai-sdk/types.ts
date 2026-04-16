import type { WordPressClient } from '../client.js';
import type { WordPressAbilityDescription, WordPressDiscoveryCatalog } from '../types/discovery.js';
import type { ZodType } from 'zod';

/**
 * Shared configuration accepted by all AI SDK tool factories.
 *
 * Developers use these options to tailor tool descriptions and lock arguments
 * that must not change at model runtime. For default values, use Zod schema
 * defaults in a custom inputSchema.
 */
export interface ToolFactoryOptions<TArgs extends Record<string, unknown>> {
  /** Override the AI-facing tool description. */
  description?: string;
  /** Override the generated tool input schema. Use Zod .default() for default values. */
  inputSchema?: ZodType;
  /** Enable provider strict-mode tool calling when supported. */
  strict?: boolean;
  /** Require approval before executing this tool. */
  needsApproval?: boolean | ((input: TArgs) => boolean | Promise<boolean>);
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
 * Shared AI SDK tool options that can consume a discovery catalog.
 *
 * When a catalog is provided, factories can tighten model-facing schemas with
 * real enums and instance-specific create/update payloads.
 */
export interface CatalogToolFactoryOptions<TArgs extends Record<string, unknown>> extends ToolFactoryOptions<TArgs> {
  /** Discovery catalog returned by `wp.explore()` or restored via storage. */
  catalog?: WordPressDiscoveryCatalog;
}

/**
 * Mutation tool options with optional discovery catalog support.
 */
export interface CatalogMutationToolFactoryOptions<TArgs extends Record<string, unknown>> extends MutationToolFactoryOptions<TArgs> {
  /** Discovery catalog returned by `wp.explore()` or restored via storage. */
  catalog?: WordPressDiscoveryCatalog;
}

/**
 * Generic content tool options.
 *
 * `contentType` pins the tool to one resource and removes the selector field
 * from the model-facing input. Omit it to expose one tool across all content
 * resources, optionally enum-backed from the discovery catalog.
 */
export interface ContentToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
}

/**
 * Generic content mutation tool options.
 */
export interface ContentMutationToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogMutationToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
}

/**
 * Generic taxonomy tool options.
 */
export interface TermToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Generic taxonomy mutation tool options.
 */
export interface TermMutationToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogMutationToolFactoryOptions<TArgs> {
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Generic ability tool options.
 */
export interface AbilityToolFactoryOptions<TArgs extends Record<string, unknown>> extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed ability name in `namespace/ability` format. */
  abilityName?: string;
}

/**
 * Options for `createAbilityTools()`, which generates one dedicated AI SDK
 * tool per discovered WordPress ability.
 *
 * Each generated tool receives the ability's own description as its tool
 * description, its `input_schema` converted to Zod as the typed input schema,
 * and auto-selects the HTTP method from the ability's annotations.
 */
export interface CreateAbilityToolsOptions {
  /**
   * Discovery catalog to generate tools from.
   *
   * Falls back to the client's cached catalog from a prior `explore()` or
   * `useCatalog()` call. Throws when neither is available.
   */
  catalog?: WordPressDiscoveryCatalog;

  /** Only generate tools for these ability names. */
  include?: string[];

  /** Skip these ability names when generating tools. */
  exclude?: string[];

  /**
   * Override the tool key used for each ability.
   *
   * Receives the raw `namespace/ability` name and the description.
   * Defaults to replacing `/` with `_` (e.g. `myapp/send_email` → `myapp_send_email`).
   */
  toolName?: (abilityName: string, ability: WordPressAbilityDescription) => string;

  /**
   * Override the AI-facing tool description for each ability.
   *
   * Defaults to the ability's `description`, enriched with `annotations.instructions`
   * when present. Falls back to the ability's `label`.
   */
  toolDescription?: (abilityName: string, ability: WordPressAbilityDescription) => string;

  /**
   * Whether each tool should require approval before executing.
   *
   * When a boolean, applies to all generated tools.
   * When a function, called per ability — destructive abilities receive
   * `needsApproval: true` by default when this option is omitted.
   */
  needsApproval?: boolean
    | ((abilityName: string, ability: WordPressAbilityDescription) => boolean | Promise<boolean>);

  /** Enable provider strict-mode tool calling when supported. */
  strict?: boolean;
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
