import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { WordPressClient, createJwtAuthHeader } from 'fluent-wp-client';
import { createAuthClient, createJwtAuthClient, createPublicClient, getBaseUrl } from '../helpers/wp-client';

/**
 * Integration coverage for the WordPress Abilities API client.
 */
describe('Client: Abilities', () => {
  const optionKey = 'test_client_ability_option';
  let authClient: WordPressClient;
  let jwtClient: WordPressClient;
  let publicClient: WordPressClient;

  /**
   * Creates one request-aware auth client for ability execution coverage.
   */
  function createRequestAwareAbilityClient(): WordPressClient {
    const token = process.env.WP_JWT_TOKEN;

    if (!token) {
      throw new Error('WP_JWT_TOKEN not set - did global-setup run?');
    }

    return new WordPressClient({
      baseUrl: getBaseUrl(),
      authHeaders: ({ method, url }) => {
        if (method !== 'POST') {
          throw new Error('Expected POST for request-aware ability auth test.');
        }

        if (!url.pathname.endsWith('/wp-json/wp-abilities/v1/abilities/test/update-option/run')) {
          throw new Error('Expected update-option run endpoint for request-aware ability auth test.');
        }

        return {
          Authorization: createJwtAuthHeader(token),
        };
      },
    });
  }

  beforeAll(() => {
    authClient = createAuthClient();
    jwtClient = createJwtAuthClient();
    publicClient = createPublicClient();
  });

  afterAll(async () => {
    await authClient.executeDeleteAbility('test/delete-option', optionKey).catch(() => undefined);
  });

  describe('metadata', () => {
    it('lists registered ability metadata', async () => {
      const abilities = await authClient.getAbilities();

      expect(abilities.some((ability) => ability.name === 'test/get-site-title')).toBe(true);
      expect(abilities.some((ability) => ability.name === 'test/process-complex')).toBe(true);
    });

    it('fetches one registered ability definition', async () => {
      const ability = await authClient.getAbility('test/get-site-title');

      expect(ability.name).toBe('test/get-site-title');
      expect(ability.meta?.annotations?.readonly).toBe(true);
      expect(ability.meta?.annotations?.destructive).toBe(false);
    });

    it('lists ability categories', async () => {
      const categories = await authClient.getAbilityCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.some((category) => category.slug === 'test')).toBe(true);
    });

    it('fetches one ability category by slug', async () => {
      const category = await authClient.getAbilityCategory('test');

      expect(category.slug).toBe('test');
      expect(typeof category.label).toBe('string');
    });
  });

  describe('get', () => {
    it('executes one read-only ability through the direct helper', async () => {
      const result = await authClient.executeGetAbility<{ title: string }>('test/get-site-title');

      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });

    it('executes one read-only ability with JWT auth', async () => {
      const result = await jwtClient.executeGetAbility<{ title: string }>('test/get-site-title');

      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });

    it('validates one read-only ability response with a response schema', async () => {
      const result = await authClient.executeGetAbility(
        'test/get-site-title',
        undefined,
        z.object({
          title: z.string().min(1),
        }),
      );

      expect(result.title.length).toBeGreaterThan(0);
    });

    it('throws for one missing read-only ability', async () => {
      await expect(
        authClient.executeGetAbility('test/non-existent-ability'),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });

    it('throws for unauthenticated read-only ability execution', async () => {
      await expect(
        publicClient.executeGetAbility('test/get-site-title'),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 401,
      });
    });

    it('rejects object input for GET ability execution because WordPress only accepts primitive query input', async () => {
      await expect(
        authClient.executeGetAbility('test/get-complex-data', { user_id: 1 }),
      ).rejects.toThrow('only supports primitive input values');
    });
  });

  describe('execute', () => {
    it('executes one regular ability through the direct helper', async () => {
      const result = await authClient.executeRunAbility<{ previous: string; current: string }>(
        'test/update-option',
        { key: optionKey, value: 'client-ability-run' },
      );

      expect(result.current).toBe('client-ability-run');
      expect(typeof result.previous).toBe('string');
    });

    it('executes one regular ability with JWT auth', async () => {
      const result = await jwtClient.executeRunAbility<{ previous: string; current: string }>(
        'test/update-option',
        { key: optionKey, value: 'client-ability-jwt' },
      );

      expect(result.current).toBe('client-ability-jwt');
    });

    it('executes one regular ability with request-aware auth headers', async () => {
      const requestAwareClient = createRequestAwareAbilityClient();
      const result = await requestAwareClient.executeRunAbility<{ previous: string; current: string }>(
        'test/update-option',
        { key: optionKey, value: 'client-ability-request-aware' },
      );

      expect(result.current).toBe('client-ability-request-aware');
    });

    it('throws for one missing regular ability', async () => {
      await expect(
        authClient.executeRunAbility('test/non-existent-ability', { value: 'x' }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });

    it('throws for unauthenticated regular ability execution', async () => {
      await expect(
        publicClient.executeRunAbility('test/update-option', { value: 'x' }),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 401,
      });
    });

    it('throws when one required execute-ability input field is missing', async () => {
      await expect(
        authClient.executeRunAbility('test/update-option', { key: optionKey }),
      ).rejects.toThrow();
    });

    it('throws when one execute-ability input property name is wrong', async () => {
      await expect(
        authClient.executeRunAbility('test/update-option', { wrong_field: 'x' }),
      ).rejects.toThrow();
    });

    it('throws when one execute-ability input type is wrong', async () => {
      await expect(
        authClient.executeRunAbility('test/update-option', { value: 12345 }),
      ).rejects.toThrow();
    });

    it('executes one complex regular ability with nested input', async () => {
      const result = await authClient.executeRunAbility<{
        processed: boolean;
        echo: {
          name: string;
          settings: { theme: string; font_size: number };
          tags: string[];
        };
      }>('test/process-complex', {
        name: 'test-config',
        settings: { theme: 'dark', font_size: 16 },
        tags: ['alpha', 'beta', 'gamma'],
      });

      expect(result.processed).toBe(true);
      expect(result.echo.name).toBe('test-config');
      expect(result.echo.settings.theme).toBe('dark');
      expect(result.echo.settings.font_size).toBe(16);
      expect(result.echo.tags).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('handles one complex regular ability with optional array omitted', async () => {
      const result = await authClient.executeRunAbility<{
        processed: boolean;
        echo: {
          name: string;
          settings: { theme: string; font_size?: number };
          tags: string[];
        };
      }>('test/process-complex', {
        name: 'minimal-config',
        settings: { theme: 'light' },
      });

      expect(result.processed).toBe(true);
      expect(result.echo.name).toBe('minimal-config');
      expect(result.echo.settings.theme).toBe('light');
      expect(result.echo.tags).toEqual([]);
    });

    it('validates one complex execute-ability response with a response schema', async () => {
      const result = await authClient.executeRunAbility(
        'test/process-complex',
        {
          name: 'schema-validated',
          settings: { theme: 'contrast' },
        },
        z.object({
          processed: z.boolean(),
          echo: z.object({
            name: z.string(),
            settings: z.object({
              theme: z.string(),
              font_size: z.number().optional(),
            }),
            tags: z.array(z.string()),
          }),
        }),
      );

      expect(result.echo.name).toBe('schema-validated');
      expect(result.echo.tags).toEqual([]);
    });

    it('throws when one complex execute ability is missing a required nested field', async () => {
      await expect(
        authClient.executeRunAbility('test/process-complex', {
          name: 'missing-settings',
        }),
      ).rejects.toThrow();
    });

    it('throws when one complex execute ability has a wrong nested type', async () => {
      await expect(
        authClient.executeRunAbility('test/process-complex', {
          name: 'wrong-type',
          settings: 'not-an-object',
        }),
      ).rejects.toThrow();
    });

    it('supports fluent ability execution with local input and output validation', async () => {
      const result = await authClient
        .ability<
          { name: string; settings: { theme: string; font_size?: number }; tags?: string[] },
          { processed: boolean; echo: { name: string; settings: { theme: string; font_size?: number }; tags: string[] } }
        >('test/process-complex')
        .inputSchema(z.object({
          name: z.string().min(1),
          settings: z.object({
            theme: z.string().min(1),
            font_size: z.number().int().positive().optional(),
          }),
          tags: z.array(z.string()).optional(),
        }))
        .outputSchema(z.object({
          processed: z.boolean(),
          echo: z.object({
            name: z.string(),
            settings: z.object({
              theme: z.string(),
              font_size: z.number().optional(),
            }),
            tags: z.array(z.string()),
          }),
        }))
        .run({
          name: 'Alpha',
          settings: { theme: 'clean', font_size: 18 },
          tags: ['featured', 'guide'],
        });

      expect(result.processed).toBe(true);
      expect(result.echo.name).toBe('Alpha');
      expect(result.echo.settings.theme).toBe('clean');
      expect(result.echo.tags).toEqual(['featured', 'guide']);
    });

    it('validates fluent ability input before the request is sent', async () => {
      await expect(
        authClient
          .ability<{ user_id: number }>('test/get-complex-data')
          .inputSchema(z.object({
            user_id: z.number().int().positive(),
          }))
          .get({ user_id: 0 }),
      ).rejects.toMatchObject({
        name: 'WordPressSchemaValidationError',
      });
    });
  });

  describe('delete', () => {
    it('executes one destructive ability through the direct helper', async () => {
      await authClient.executeRunAbility('test/update-option', { key: optionKey, value: 'client-ability-delete' });

      const result = await authClient.executeDeleteAbility<{ deleted: boolean; previous: string }>('test/delete-option', optionKey);

      expect(result.deleted).toBe(true);
      expect(result.previous).toBe('client-ability-delete');
    });

    it('executes one destructive ability with JWT auth', async () => {
      await authClient.executeRunAbility('test/update-option', { key: optionKey, value: 'client-ability-jwt-delete' });

      const result = await jwtClient.executeDeleteAbility<{ deleted: boolean; previous: string }>('test/delete-option', optionKey);

      expect(result.deleted).toBe(true);
      expect(result.previous).toBe('client-ability-jwt-delete');
    });

    it('throws for one missing destructive ability', async () => {
      await expect(
        authClient.executeDeleteAbility('test/non-existent-ability'),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 404,
      });
    });

    it('throws for unauthenticated destructive ability execution', async () => {
      await expect(
        publicClient.executeDeleteAbility('test/delete-option', optionKey),
      ).rejects.toMatchObject({
        name: 'WordPressApiError',
        status: 401,
      });
    });
  });
});
