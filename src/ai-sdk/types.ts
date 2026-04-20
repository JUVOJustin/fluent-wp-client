import type { ZodType } from "zod";
import type { WordPressParsedBlock } from "../blocks.js";
import type { WordPressPostLike } from "../schemas.js";
import type {
  WordPressAbilityDescription,
  WordPressDiscoveryCatalog,
} from "../types/discovery.js";
import type { QueryParams } from "../types/resources.js";
import type { ContentItemResult } from "./factories.js";

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
 * Options for `getContentCollectionTool`.
 *
 * `contentType` pins the tool to one resource and removes the selector from
 * the model-facing input. `fetch` replaces the default client list call with a
 * custom implementation — useful for routing through a cache or live loader.
 */
export interface ContentCollectionToolOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives the fully resolved `contentType` and normalised `filter` after
   * `fixedArgs` and field-selection normalisation have been applied.
   */
  fetch?: (input: {
    contentType: string;
    filter: QueryParams;
  }) => Promise<WordPressPostLike[]>;
}

/**
 * Options for `getContentTool`.
 *
 * `fetch` replaces the default client item call. Receives the resolved
 * `contentType`, the id or slug the model provided, and the content/block
 * inclusion flags plus any field-selection override.
 */
export interface ContentGetToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives resolved args after `fixedArgs` have been applied.
   */
  fetch?: (input: {
    contentType: string;
    fields?: string[];
    id?: number;
    slug?: string;
    includeContent?: boolean;
    includeBlocks?: boolean;
  }) => Promise<ContentItemResult<WordPressPostLike | undefined> | undefined>;
}

/**
 * Options for `saveContentTool`.
 *
 * One unified write tool covers both create and update. Presence of `id` at
 * runtime switches the client call to an update; omitting `id` creates a new
 * item.
 */
export interface ContentSaveToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogMutationToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
  /**
   * Replace the default client call. Receives the resolved `contentType`,
   * optional `id`, and merged `input` after `fixedInput` has been applied.
   */
  fetch?: (input: {
    contentType: string;
    id?: number;
    input: Record<string, unknown>;
  }) => Promise<unknown>;
}

/**
 * Options for `deleteContentTool`.
 */
export interface ContentDeleteToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogMutationToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
  /**
   * Replace the default client call. Receives the resolved `contentType`,
   * `id`, and optional `force` flag.
   */
  fetch?: (input: {
    contentType: string;
    id: number;
    force?: boolean;
  }) => Promise<unknown>;
}

/**
 * Options for `getTermCollectionTool`.
 */
export interface TermCollectionToolOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogToolFactoryOptions<TArgs> {
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives the resolved `taxonomyType` and normalised `filter`.
   */
  fetch?: (input: {
    taxonomyType: string;
    filter: QueryParams;
  }) => Promise<Record<string, unknown>[]>;
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Options for `getTermTool`.
 */
export interface TermGetToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogToolFactoryOptions<TArgs> {
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives resolved args after `fixedArgs` have been applied.
   */
  fetch?: (input: {
    taxonomyType: string;
    fields?: string[];
    id?: number;
    slug?: string;
  }) => Promise<Record<string, unknown>>;
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Options for `saveTermTool`.
 *
 * One unified write tool covers both create and update. Presence of `id` at
 * runtime switches the client call to an update; omitting `id` creates a
 * new term.
 */
export interface TermSaveToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogMutationToolFactoryOptions<TArgs> {
  /**
   * Replace the default client call. Receives the resolved `taxonomyType`,
   * optional `id`, and merged `input` after `fixedInput` has been applied.
   */
  fetch?: (input: {
    taxonomyType: string;
    id?: number;
    input: Record<string, unknown>;
  }) => Promise<unknown>;
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Options for `deleteTermTool`.
 */
export interface TermDeleteToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogMutationToolFactoryOptions<TArgs> {
  /**
   * Replace the default client call. Receives the resolved `taxonomyType`,
   * `id`, and optional `force` flag.
   */
  fetch?: (input: {
    taxonomyType: string;
    id: number;
    force?: boolean;
  }) => Promise<unknown>;
  /** Fixed taxonomy REST base such as `categories`, `tags`, or `genre`. */
  taxonomyType?: string;
}

/**
 * Options for `getResourceCollectionTool`.
 */
export interface ResourceCollectionToolOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogToolFactoryOptions<TArgs> {
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives the resolved `resourceType` and normalised `filter`.
   */
  fetch?: (input: {
    resourceType: string;
    filter: QueryParams;
  }) => Promise<Record<string, unknown>[]>;
  resourceType?: "media" | "comments" | "users";
}

/**
 * Options for `getResourceTool`.
 */
export interface ResourceGetToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogToolFactoryOptions<TArgs> {
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives resolved args after `fixedArgs` have been applied.
   */
  fetch?: (input: {
    resourceType: string;
    fields?: string[];
    id?: number;
    slug?: string;
  }) => Promise<Record<string, unknown>>;
  resourceType?: "media" | "comments" | "users";
}

/**
 * Options for `saveResourceTool`.
 *
 * One unified write tool covers both create and update. Presence of `id` at
 * runtime switches the client call to an update; omitting `id` creates a
 * new resource. Media writes remain unsupported — use
 * `client.media().upload()` directly.
 */
export interface ResourceSaveToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogMutationToolFactoryOptions<TArgs> {
  /**
   * Replace the default client call. Receives the resolved `resourceType`,
   * optional `id`, and merged `input` after `fixedInput` has been applied.
   */
  fetch?: (input: {
    resourceType: string;
    id?: number;
    input: Record<string, unknown>;
  }) => Promise<unknown>;
  resourceType?: "media" | "comments" | "users";
}

/**
 * Options for `deleteResourceTool`.
 */
export interface ResourceDeleteToolOptions<
  TArgs extends Record<string, unknown>,
> extends CatalogMutationToolFactoryOptions<TArgs> {
  /**
   * Replace the default client call. Receives the resolved `resourceType`,
   * `id`, and optional `force` / `reassign` flags.
   */
  fetch?: (input: {
    resourceType: string;
    id: number;
    force?: boolean;
    reassign?: number;
  }) => Promise<unknown>;
  resourceType?: "media" | "comments" | "users";
}

/**
 * Options for `getSettingsTool`.
 */
export interface SettingsGetToolOptions
  extends ToolFactoryOptions<Record<string, unknown>> {
  /**
   * Replace the default client fetch with a custom implementation.
   * Called with no arguments — settings are a singleton.
   */
  fetch?: () => Promise<Record<string, unknown>>;
}

/**
 * Options for `setBlocksTool`.
 */
export interface BlocksSetToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
  /**
   * Replace the default client call. Receives the resolved `contentType`,
   * numeric `id`, and the validated blocks array.
   */
  fetch?: (input: {
    contentType: string;
    id: number;
    blocks: WordPressParsedBlock[];
  }) => Promise<unknown>;
}

/**
 * Options for `getBlocksTool`.
 */
export interface BlocksGetToolOptions<TArgs extends Record<string, unknown>>
  extends CatalogToolFactoryOptions<TArgs> {
  /** Fixed post-like REST base such as `posts`, `pages`, or `books`. */
  contentType?: string;
  /**
   * Replace the default client fetch with a custom implementation.
   * Receives the resolved `contentType` and numeric `id`.
   */
  fetch?: (input: { contentType: string; id: number }) => Promise<{
    id: number;
    contentType: string;
    blocks: WordPressParsedBlock[];
  }>;
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
   * Defaults to the ability's `description`, enriched with
   * `annotations.instructions` when present. Falls back to the ability's
   * `label`.
   */
  toolDescription?: (
    abilityName: string,
    ability: WordPressAbilityDescription,
  ) => string;

  /**
   * Override the tool key used for each ability.
   *
   * Receives the raw `namespace/ability` name and the description.
   * Defaults to replacing `/` with `_` (e.g. `myapp/send_email` →
   * `myapp_send_email`).
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
