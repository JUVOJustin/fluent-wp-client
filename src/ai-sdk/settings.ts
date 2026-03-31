import { tool } from 'ai';
import { z } from 'zod';
import type { WordPressClient } from '../client.js';
import { mergeToolArgs, mergeMutationInput } from './merge.js';
import { asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions, MutationToolFactoryOptions } from './types.js';
import { settingsUpdateInputSchema } from './schemas.js';

/**
 * AI SDK tool that fetches WordPress site settings.
 */
export const getSettingsTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get WordPress site settings',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: z.object({}).describe('No input required'),
  execute: withToolErrorHandling(async () => {
    return client.settings().get();
  }),
});

/**
 * AI SDK tool that updates WordPress site settings.
 */
export const updateSettingsTool = (
  client: WordPressClient,
  options?: MutationToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Update WordPress site settings',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: settingsUpdateInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    const withInput = mergeMutationInput(merged, options?.defaultInput, options?.fixedInput);
    return client.settings().update(withInput.input as Record<string, unknown>);
  }),
});
