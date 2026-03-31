import type { WordPressSettings } from '../schemas.js';
import type {
  SettingsResourceClient,
  WordPressRequestOverrides,
} from '../types/resources.js';
import type { WordPressResourceDescription } from '../types/discovery.js';
import { settingsSchema } from '../standard-schemas.js';
import { compactPayload } from '../core/params.js';
import { resolveMutationSchema, type MutationOptions } from '../core/mutation-helpers.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import { throwIfWordPressError } from '../core/errors.js';
import { validateWithStandardSchema } from '../core/validation.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress settings singleton resource.
 */
export class SettingsResource {
  private readonly runtime: WordPressRuntime;
  private readonly endpoint = '/settings';

  constructor(runtime: WordPressRuntime) {
    this.runtime = runtime;
  }

  /**
   * Creates a settings resource instance.
   */
  static create(runtime: WordPressRuntime): SettingsResource {
    return new SettingsResource(runtime);
  }

  /**
   * Ensures settings reads and writes only run when authentication is configured.
   */
  private assertAuthenticated(): void {
    if (!this.runtime.hasAuth()) {
      throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
    }
  }

  /**
   * Gets WordPress site settings.
   */
  async get(requestOptions?: WordPressRequestOverrides): Promise<WordPressSettings> {
    this.assertAuthenticated();

    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: this.endpoint,
      method: 'GET',
    }, requestOptions));

    throwIfWordPressError(response, data);
    return validateWithStandardSchema(settingsSchema, data, 'Settings response validation failed');
  }

  /**
   * Updates WordPress site settings.
   *
   * Accepts an optional `MutationOptions` object as the second parameter to
   * provide `inputSchema` (validates the settings payload before the request)
   * and/or `responseSchema` (validates the server response). For backward
   * compatibility, a bare Standard Schema or request overrides object are also
   * accepted.
   */
  async update<TSettings = WordPressSettings>(
    input: Partial<WordPressSettings> & Record<string, unknown>,
    mutationOptionsOrResponseSchema?: MutationOptions<Partial<WordPressSettings> & Record<string, unknown>, TSettings> | WordPressStandardSchema<TSettings> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TSettings> {
    this.assertAuthenticated();

    const resolved = resolveMutationSchema<TSettings, Partial<WordPressSettings> & Record<string, unknown>>(
      mutationOptionsOrResponseSchema,
      requestOptions,
      undefined,
    );

    // Validate and transform input before making the HTTP request
    const body = resolved.inputSchema
      ? await validateWithStandardSchema(resolved.inputSchema, input, 'WordPress settings input validation failed')
      : input;

    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: this.endpoint,
      method: 'POST',
      body: compactPayload(body as Partial<WordPressSettings> & Record<string, unknown>),
    }, resolved.requestOptions));

    throwIfWordPressError(response, data);

    return validateWithStandardSchema(
      resolved.responseSchema ?? (settingsSchema as WordPressStandardSchema<TSettings>),
      data,
      'Settings response validation failed',
    );
  }
}

/**
 * Creates a typed settings client with optional mutation validation.
 */
export function createSettingsClient<TResource extends WordPressSettings = WordPressSettings>(
  resource: SettingsResource,
  responseSchema?: WordPressStandardSchema<TResource>,
  describeFn?: (options?: WordPressRequestOverrides) => Promise<WordPressResourceDescription>,
): SettingsResourceClient<TResource> {
  return {
    get: async (options) => {
      const settings = await resource.get(options);
      return validateWithStandardSchema(
        (responseSchema ?? settingsSchema) as WordPressStandardSchema<TResource>,
        settings,
        'Settings response validation failed',
      );
    },
    update: <TResponse = TResource>(
      input: Partial<WordPressSettings> & Record<string, unknown>,
      mutationOptionsOrResponseSchema?: MutationOptions<Partial<WordPressSettings> & Record<string, unknown>, TResponse> | WordPressStandardSchema<TResponse> | WordPressRequestOverrides,
      requestOptions?: WordPressRequestOverrides,
    ) => {
      const resolved = resolveMutationSchema(
        mutationOptionsOrResponseSchema,
        requestOptions,
        responseSchema as WordPressStandardSchema<TResponse> | undefined,
      );

      return resource.update<TResponse>(
        input,
        {
          inputSchema: resolved.inputSchema as WordPressStandardSchema<Partial<WordPressSettings> & Record<string, unknown>> | undefined,
          responseSchema: resolved.responseSchema,
          ...resolved.requestOptions,
        },
      );
    },
    describe: describeFn ?? (() => Promise.reject(new Error('describe() not available for this resource'))),
  };
}
