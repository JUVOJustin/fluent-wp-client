import type { ZodType } from "zod";
import type { WordPressParsedBlock } from "../blocks.js";
import type { WordPressClient } from "../client.js";
import type { WordPressPostLike } from "../schemas.js";
import type {
  WordPressAbilityDescription,
  WordPressDiscoveryCatalog,
} from "../types/discovery.js";
import type { QueryParams } from "../types/resources.js";
import type { ContentItemResult } from "./factories.js";

/**
 * Optional read hooks that AI SDK read tools can delegate to instead of calling
 * the WordPress client directly.
 *
 * Use this to route reads through a cached integration layer such as Astro live
 * loaders, SWR, or a CDN-backed edge cache without changing write paths.
 *
 * Each hook receives only the resolved, normalized arguments the tool already
 * computed. The client instance is intentionally excluded — if the adapter
 * needs the client, it is not replacing the read path, it is wrapping it.
 */
export interface WordPressAIReadAdapter {
  /**
   * Replaces the default `getBlocksTool` read.
   * Must return `{ id, contentType, blocks }`.
   */
  getBlocks?: (input: { contentType: string; id: number }) => Promise<{
    id: number;
    contentType: string;
    blocks: WordPressParsedBlock[];
  }>;

  /**
   * Replaces the default `getContentTool` read.
   * Must return a `ContentItemResult`-compatible shape.
   */
  getContent?: (input: {
    contentType: string;
    id?: number;
    slug?: string;
    includeContent?: boolean;
    includeBlocks?: boolean;
  }) => Promise<ContentItemResult<WordPressPostLike | undefined> | undefined>;

  /**
   * Replaces the default `getResourceTool` read for media, comments, or users.
   * `resourceType` matches the REST base string (e.g. `"media"`, `"users"`).
   */
  getResource?: (input: {
    resourceType: string;
    id?: number;
    slug?: string;
  }) => Promise<Record<string, unknown>>;

  /**
   * Replaces the default `getSettingsTool` read.
   */
  getSettings?: () => Promise<Record<string, unknown>>;

  /**
   * Replaces the default `getTermTool` read.
   */
  getTerm?: (input: {
    taxonomyType: string;
    id?: number;
    slug?: string;
  }) => Promise<Record<string, unknown>>;

  /**
   * Replaces the default `getContentCollectionTool` read.
   * Must return an array of post-like DTOs.
   */
  listContent?: (input: {
    contentType: string;
    filter: QueryParams;
  }) => Promise<WordPressPostLike[]>;

  /**
   * Replaces the default `getResourceCollectionTool` read.
   * `resourceType` matches the REST base string (e.g. `"media"`, `"users"`).
   */
  listResource?: (input: {
    resourceType: string;
    filter: QueryParams;
  }) => Promise<Record<string, unknown>[]>;

  /**
   * Replaces the default `getTermCollectionTool` read.
   * Must return an array of term DTOs.
   */
  listTerms?: (input: {
    taxonomyType: string;
    filter: QueryParams;
  }) => Promise<Record<string, unknown>[]>;
}

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
  /** Locked arguments that always override model-provided input. */
  fixedArgs?: Partial<TArgs>;
  /** Override the generated tool input schema. Use Zod .default() for default values. */
  inputSchema?: ZodType;
  /** Require approval before executing this tool. */
  needsApproval?: boolean | ((input: TArgs) => boolean | Promise<boolean>);
  /** Enable provider strict-mode tool calling when supported. */
  strict?: boolean;
}

/**
 * Mixin that adds an optional read adapter to read-only tool factory options.
 *
 * Only applied to read tool options — mutation tools do not accept a
 * `readAdapter` because it has no effect on their execution path.
 */
export interface ReadAdapterOptions {
  /** Route reads through a cached or framework-managed integration instead of the client. */
  readAdapter?: WordPressAIReadAdapter;
}

/**
 * Mutation tool options support nested `input` defaults and overrides.
 */
export interface MutationToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends ToolFactoryOptions<TArgs> {
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
export interface CatalogToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends ToolFactoryOptions<TArgs> {
  /** Discovery catalog returned by `wp.explore()` or restored via storage. */
  catalog?: WordPressDiscoveryCatalog;
}

/**
 * Mutation tool options with optional discovery catalog support.
 */
export interface CatalogMutationToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends MutationToolFactoryOptions<TArgs> {
  /** Discovery catalog returned by `wp.explore()` or restored via storage. */
  catalog?: WordPressDiscoveryCatalog;
}

/**
 * Generic content tool options for read operations.
 *
 * `contentType` pins the tool to one resource and removes the selector field
 * from the model-facing input. Omit it to expose one tool across all content
 * resources, optionally enum-backed from the discovery catalog.
 */
export interface ContentToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogToolFactoryOptions<TArgs>,
    ReadAdapterOptions {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
}

/**
 * Generic content mutation tool options.
 */
export interface ContentMutationToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogMutationToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
}

/**
 * Generic taxonomy tool options for read operations.
 */
export interface TermToolFactoryOptions<TArgs extends Record<string, unknown>>
  extends CatalogToolFactoryOptions<TArgs>,
    ReadAdapterOptions {
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Generic taxonomy mutation tool options.
 */
export interface TermMutationToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogMutationToolFactoryOptions<TArgs> {
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Generic ability tool options.
 */
export interface AbilityToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogToolFactoryOptions<TArgs> {
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

  /** Skip these ability names when generating tools. */
  exclude?: string[];

  /** Only generate tools for these ability names. */
  include?: string[];

  /**
   * Whether each tool should require approval before executing.
   *
   * When a boolean, applies to all generated tools.
   * When a function, called per ability — destructive abilities receive
   * `needsApproval: true` by default when this option is omitted.
   */
  needsApproval?:
    | boolean
    | ((
        abilityName: string,
        ability: WordPressAbilityDescription,
      ) => boolean | Promise<boolean>);

  /** Enable provider strict-mode tool calling when supported. */
  strict?: boolean;

  /**
   * Override the AI-facing tool description for each ability.
   *
   * Defaults to the ability's `description`, enriched with `annotations.instructions`
   * when present. Falls back to the ability's `label`.
   */
  toolDescription?: (
    abilityName: string,
    ability: WordPressAbilityDescription,
  ) => string;

  /**
   * Override the tool key used for each ability.
   *
   * Receives the raw `namespace/ability` name and the description.
   * Defaults to replacing `/` with `_` (e.g. `myapp/send_email` → `myapp_send_email`).
   */
  toolName?: (
    abilityName: string,
    ability: WordPressAbilityDescription,
  ) => string;
}

/**
 * Configuration for a generic content or term tool factory.
 *
 * Adds the `resource` string so the factory knows which REST endpoint to target.
 */
export interface GenericResourceToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends ToolFactoryOptions<TArgs> {
  /** REST base for the custom resource, e.g. `'books'` or `'genre'`. */
  resource: string;
}

/**
 * Generic mutation tool options for custom resources.
 */
export interface GenericMutationToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends MutationToolFactoryOptions<TArgs> {
  /** REST base for the custom resource. */
  resource: string;
}

/**
 * Read-only resource tool options.
 */
export interface ResourceReadToolFactoryOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogToolFactoryOptions<TArgs>,
    ReadAdapterOptions {
  resourceType?: "media" | "comments" | "users";
}

/**
 * Internal tool factory runtime that carries a client reference.
 */
export type ToolClient = WordPressClient;
