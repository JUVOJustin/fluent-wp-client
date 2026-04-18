import { tool } from "ai";
import { z } from "zod";
import type { WordPressClient } from "../client.js";
import { asToolArgs, withToolErrorHandling } from "./factories.js";
import { mergeMutationInput, mergeToolArgs } from "./merge.js";
import { settingsUpdateInputSchema } from "./schemas.js";
import type {
  MutationToolFactoryOptions,
  ToolFactoryOptions,
} from "./types.js";

/**
 * AI SDK tool that fetches WordPress site settings.
 */
export const getSettingsTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) =>
  tool({
    description: options?.description ?? "Get WordPress site settings",
    execute: withToolErrorHandling(async () => {
      if (options?.readAdapter?.getSettings) {
        return options.readAdapter.getSettings({ client });
      }
      return client.settings().get();
    }),
    inputSchema: z.object({}).describe("No input required"),
    needsApproval: options?.needsApproval,
    strict: options?.strict,
  });

/**
 * AI SDK tool that updates WordPress site settings.
 */
export const updateSettingsTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) =>
  tool({
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
