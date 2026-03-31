import { tool } from 'ai';
import { z } from 'zod';
import type { WordPressClient } from '../client.js';
import { mergeToolArgs } from './merge.js';
import { asToolArgs, withToolErrorHandling } from './factories.js';
import type { ToolFactoryOptions } from './types.js';
import {
  abilityGetInputSchema,
  abilityRunInputSchema,
  abilityDeleteInputSchema,
} from './schemas.js';

/**
 * AI SDK tool that lists all registered WordPress abilities.
 */
export const getAbilitiesTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'List all registered WordPress abilities',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: z.object({}).describe('No input required'),
  execute: withToolErrorHandling(async () => {
    return client.getAbilities();
  }),
});

/**
 * AI SDK tool that fetches metadata for one WordPress ability.
 */
export const getAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get metadata for a WordPress ability',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: z.object({
    name: z.string().describe('Ability name in namespace/ability format'),
  }).describe('Ability metadata lookup'),
  execute: withToolErrorHandling(async (args) => {
    return client.getAbility(args.name);
  }),
});

/**
 * AI SDK tool that executes a read-only WordPress ability via GET.
 */
export const executeGetAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Execute a read-only WordPress ability via GET',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: abilityGetInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.executeGetAbility(merged.name as string, merged.input);
  }),
});

/**
 * AI SDK tool that executes a WordPress ability via POST.
 */
export const executeRunAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Execute a WordPress ability via POST',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: abilityRunInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.executeRunAbility(merged.name as string, merged.input);
  }),
});

/**
 * AI SDK tool that executes a destructive WordPress ability via DELETE.
 */
export const executeDeleteAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Execute a destructive WordPress ability via DELETE',
  strict: options?.strict,
  needsApproval: options?.needsApproval,
  inputSchema: abilityDeleteInputSchema,
  execute: withToolErrorHandling(async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, asToolArgs(args), options?.fixedArgs);
    return client.executeDeleteAbility(merged.name as string, merged.input);
  }),
});
