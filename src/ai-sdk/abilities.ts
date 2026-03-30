import { tool } from 'ai';
import { z } from 'zod';
import type { WordPressClient } from '../client.js';
import { mergeToolArgs } from './merge.js';
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
  inputSchema: z.object({}).describe('No input required'),
  execute: async () => {
    return client.getAbilities();
  },
});

/**
 * AI SDK tool that fetches metadata for one WordPress ability.
 */
export const getAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Get metadata for a WordPress ability',
  inputSchema: z.object({
    name: z.string().describe('Ability name in namespace/ability format'),
  }).describe('Ability metadata lookup'),
  execute: async (args) => {
    return client.getAbility(args.name);
  },
});

/**
 * AI SDK tool that executes a read-only WordPress ability via GET.
 */
export const executeGetAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Execute a read-only WordPress ability via GET',
  inputSchema: abilityGetInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    return client.executeGetAbility(merged.name as string, merged.input);
  },
});

/**
 * AI SDK tool that executes a WordPress ability via POST.
 */
export const executeRunAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Execute a WordPress ability via POST',
  inputSchema: abilityRunInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    return client.executeRunAbility(merged.name as string, merged.input);
  },
});

/**
 * AI SDK tool that executes a destructive WordPress ability via DELETE.
 */
export const executeDeleteAbilityTool = (
  client: WordPressClient,
  options?: ToolFactoryOptions<Record<string, unknown>>,
) => tool({
  description: options?.description ?? 'Execute a destructive WordPress ability via DELETE',
  inputSchema: abilityDeleteInputSchema,
  execute: async (args) => {
    const merged = mergeToolArgs(options?.defaultArgs ?? {}, args as unknown as Record<string, unknown>, options?.fixedArgs);
    return client.executeDeleteAbility(merged.name as string, merged.input);
  },
});
