import { tool } from "ai";
import { z } from "zod";
import type { WordPressClient } from "../client.js";
import { asToolArgs, withToolErrorHandling } from "./factories.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import { settingsUpdateInputSchema } from "./schemas.js";
import type {
  MutationToolFactoryOptions,
  SettingsGetToolOptions,
} from "./types.js";

/**
 * AI SDK tool that fetches WordPress site settings.
 *
 * Provide `fetch` to replace the default client call — settings are a
 * singleton so the callback receives no arguments.
 */
export const getSettingsTool = (
  client: WordPressClient,
  options?: SettingsGetToolOptions,
) =>
  tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Get WordPress site settings",
    execute: withToolErrorHandling(async () => {
      if (options?.fetch) {
        return options.fetch();
      }

      return client.settings().get();
    }),
    inputSchema: z.object({}).describe("No input required"),
    needsApproval: options?.needsApproval,
    strict: options?.strict,
  });

/**
 * AI SDK tool that updates WordPress site settings.
 *
 * Provide `fetch` to replace the default client call. Receives the merged
 * `input` after `fixedInput` has been applied.
 */
export const updateSettingsTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) =>
  tool({
    ...(options?.toolOptions as Record<string, unknown> | undefined),
    description: options?.description ?? "Update WordPress site settings",
    execute: withToolErrorHandling(async (args) => {
      const merged = mergeToolArgs(asToolArgs(args), options?.fixedArgs);
      const withInput = mergeMutationInput(
        merged,
        options?.defaultInput,
        options?.fixedInput,
      );
      return client
        .settings()
        .update(withInput.input as Record<string, unknown>);
    }),
    inputSchema: settingsUpdateInputSchema,
    needsApproval: options?.needsApproval,
    strict: options?.strict,
  });
