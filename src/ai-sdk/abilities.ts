import { tool } from "ai";
import { z } from "zod";
import type { WordPressClient } from "../client.js";
import { createInvalidRequestError } from "../core/errors.js";
import type { WordPressAbilityDescription } from "../types/discovery.js";
import { zodSchemasFromDescription } from "../zod-helpers.js";
import {
  createAbilityDeleteInputSchema,
  createAbilityGetInputSchema,
  createAbilityRunInputSchema,
} from "./catalog-schemas.js";
import { asToolArgs, withToolErrorHandling } from "./factories.js";
import { mergeToolArgs } from "./merge.js";
import type {
  AbilityToolFactoryOptions,
  CreateAbilityToolsOptions,
  ToolFactoryOptions,
} from "./types.js";

function resolveAbilityName(
  merged: Record<string, unknown>,
  options?: { abilityName?: string },
): string {
  const abilityName =
    options?.abilityName ??
    (typeof merged.name === "string" ? merged.name : undefined);
  if (!abilityName) {
    throw createInvalidRequestError(
      "ability name must be provided either in the tool config or the tool input.",
    );
  }

  return abilityName;
}

/**
 * AI SDK tool that lists all registered WordPress abilities.
 */
export const getAbilitiesTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) =>
  tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ?? "List all registered WordPress abilities",
    execute: withToolErrorHandling(async () => {
      return client.getAbilities();
    }),
    inputSchema: z.object({}).describe("No input required"),
    needsApproval: options?.needsApproval,
    strict: options?.strict,
  });

/**
 * AI SDK tool that fetches metadata for one WordPress ability.
 */
export const getAbilityTool = (
  client: WordPressClient,
  options?: AbilityToolFactoryOptions<Record<string, unknown>>,
) => {
  const _resolvedOptions = {
    ...options,
    catalog: client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Get metadata for a WordPress ability",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      return client.getAbility(resolveAbilityName(merged, options));
    }),
    inputSchema: (options?.inputSchema ??
      (options?.abilityName
        ? z
            .object({})
            .describe(`Ability metadata lookup for ${options.abilityName}`)
        : z
            .object({
              name: z
                .string()
                .describe("Ability name in namespace/ability format"),
            })
            .describe("Ability metadata lookup"))) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that executes a read-only WordPress ability via GET.
 */
export const executeGetAbilityTool = (
  client: WordPressClient,
  options?: AbilityToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ?? "Execute a read-only WordPress ability via GET",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      return client.executeGetAbility(
        resolveAbilityName(merged, options),
        merged.input,
      );
    }),
    inputSchema: (options?.inputSchema ??
      createAbilityGetInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that executes a WordPress ability via POST.
 */
export const executeRunAbilityTool = (
  client: WordPressClient,
  options?: AbilityToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Execute a WordPress ability via POST",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      return client.executeRunAbility(
        resolveAbilityName(merged, options),
        merged.input,
      );
    }),
    inputSchema: (options?.inputSchema ??
      createAbilityRunInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

/**
 * AI SDK tool that executes a destructive WordPress ability via DELETE.
 */
export const executeDeleteAbilityTool = (
  client: WordPressClient,
  options?: AbilityToolFactoryOptions<Record<string, unknown>>,
) => {
  const resolvedOptions = {
    ...options,
    catalog: client.getCachedCatalog(),
  };
  return tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description:
      options?.description ??
      "Execute a destructive WordPress ability via DELETE",
    execute: withToolErrorHandling(async (args: unknown) => {
      const merged = mergeToolArgs(
        asToolArgs(args as Record<string, unknown>),
        options?.fixedArgs,
      );
      return client.executeDeleteAbility(
        resolveAbilityName(merged, options),
        merged.input,
      );
    }),
    inputSchema: (options?.inputSchema ??
      createAbilityDeleteInputSchema(resolvedOptions)) as never,
    needsApproval: options?.needsApproval as never,
    strict: options?.strict,
  });
};

// ---------------------------------------------------------------------------
// Bulk ability tool generation
// ---------------------------------------------------------------------------

/**
 * Converts a `namespace/ability` name into a safe tool key.
 *
 * Replaces `/` with `_` so tool names are valid JavaScript identifiers
 * that read naturally in AI SDK `tools` objects.
 */
function defaultToolName(abilityName: string): string {
  return abilityName.replace(/\//g, "_");
}

/**
 * Builds a tool description from the ability's metadata.
 *
 * Prefers `description`, enriched with `annotations.instructions` when
 * present. Falls back to `label` when no description is available.
 */
function defaultToolDescription(
  abilityName: string,
  ability: WordPressAbilityDescription,
): string {
  const raw = ability.raw as Record<string, unknown> | undefined;
  const description =
    (raw?.description as string) || (raw?.label as string) || abilityName;
  const instructions = (ability.annotations?.instructions as string) || "";

  return instructions ? `${description}\n\n${instructions}` : description;
}

/**
 * Returns the default `needsApproval` value for one ability based on its
 * annotations. Destructive abilities require approval by default.
 */
function defaultNeedsApproval(ability: WordPressAbilityDescription): boolean {
  return ability.annotations?.destructive === true;
}

/**
 * Selects the HTTP method for one ability based on its annotations.
 *
 * `readonly` → GET, `destructive` → DELETE, otherwise → POST.
 */
function resolveMethod(
  ability: WordPressAbilityDescription,
): "get" | "run" | "delete" {
  if (ability.annotations?.readonly === true) return "get";
  if (ability.annotations?.destructive === true) return "delete";
  return "run";
}

/**
 * Builds the Zod input schema for one ability tool.
 *
 * Uses the ability's `input_schema` from discovery when available,
 * falling back to `z.unknown().optional()` for abilities without input.
 */
function buildAbilityInputSchema(
  ability: WordPressAbilityDescription,
): z.ZodType {
  const schemas = zodSchemasFromDescription(ability);

  if (schemas.input) {
    return z
      .object({
        input: schemas.input.describe("Input for the ability"),
      })
      .describe(`Execute the ${ability.name} WordPress ability`);
  }

  return z
    .object({
      input: z.unknown().optional().describe("Optional input for the ability"),
    })
    .describe(`Execute the ${ability.name} WordPress ability`);
}

/**
 * Resolves the `needsApproval` value for one ability tool.
 */
function resolveNeedsApproval(
  abilityName: string,
  ability: WordPressAbilityDescription,
  option?: CreateAbilityToolsOptions["needsApproval"],
): boolean | (() => boolean | Promise<boolean>) {
  if (option === undefined) return defaultNeedsApproval(ability);
  if (typeof option === "boolean") return option;
  return () => option(abilityName, ability);
}

/**
 * Builds the execute function for one ability tool.
 */
function buildExecute(
  client: WordPressClient,
  abilityName: string,
  method: "get" | "run" | "delete",
): (args: unknown) => Promise<unknown> {
  return async (args: unknown) => {
    const parsed = args as Record<string, unknown>;
    const input = parsed.input;

    if (method === "get") return client.executeGetAbility(abilityName, input);
    if (method === "delete")
      return client.executeDeleteAbility(abilityName, input);
    return client.executeRunAbility(abilityName, input);
  };
}

/**
 * Generates one dedicated AI SDK tool per discovered WordPress ability.
 *
 * Instead of a single generic "execute ability" tool where the model must
 * know ability names and pass untyped input, this factory produces a
 * separate tool for each ability with:
 *
 * - The ability's own `description` / `label` as the tool description
 * - The ability's `input_schema` converted to Zod as the typed input
 * - Auto-selected HTTP method from annotations (`readonly` → GET,
 *   `destructive` → DELETE, else → POST)
 * - Destructive abilities default to `needsApproval: true`
 *
 * @example
 * ```ts
 * await wp.explore(); // populates the cached catalog
 * const tools = createAbilityTools(wp);
 *
 * const result = await generateText({
 *   model,
 *   tools: { ...tools, ...otherTools },
 * });
 * ```
 *
 * @example Filter to specific abilities
 * ```ts
 * const tools = createAbilityTools(wp, {
 *   include: ['myapp/send_email', 'myapp/get_analytics'],
 * });
 * ```
 *
 * @returns A `Record<string, Tool>` keyed by sanitized ability names.
 */
export function createAbilityTools(
  client: WordPressClient,
  options?: CreateAbilityToolsOptions,
): Record<string, ReturnType<typeof tool>> {
  const catalog = client.getCachedCatalog();

  if (!catalog) {
    throw createInvalidRequestError(
      "createAbilityTools() requires a discovery catalog. Call wp.explore() or wp.useCatalog() before generating ability tools.",
    );
  }

  const abilities = catalog.abilities ?? {};
  const include = options?.include ? new Set(options.include) : undefined;
  const exclude = options?.exclude ? new Set(options.exclude) : undefined;

  const tools: Record<string, ReturnType<typeof tool>> = {};

  for (const [abilityName, ability] of Object.entries(abilities)) {
    if (include && !include.has(abilityName)) continue;
    if (exclude?.has(abilityName)) continue;

    const toolKey = options?.toolName
      ? options.toolName(abilityName, ability)
      : defaultToolName(abilityName);

    const description = options?.toolDescription
      ? options.toolDescription(abilityName, ability)
      : defaultToolDescription(abilityName, ability);

    const method = resolveMethod(ability);
    const inputSchema = buildAbilityInputSchema(ability);
    const needsApproval = resolveNeedsApproval(
      abilityName,
      ability,
      options?.needsApproval,
    );

    tools[toolKey] = tool({
      ...(options?.toolOptions as Record<string, unknown> | undefined),
      description,
      execute: withToolErrorHandling(
        buildExecute(client, abilityName, method),
      ) as never,
      inputSchema: inputSchema as never,
      needsApproval: needsApproval as never,
      strict: options?.strict,
    });
  }

  return tools;
}
