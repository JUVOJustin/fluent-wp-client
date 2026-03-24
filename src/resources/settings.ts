import type { WordPressSettings } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import { settingsSchema } from '../standard-schemas.js';
import { compactPayload } from '../core/params.js';
import { resolveMutationArguments } from '../core/mutation-helpers.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
import { throwIfWordPressError } from '../core/errors.js';
import { validateWithStandardSchema } from '../core/validation.js';
import type { WordPressStandardSchema } from '../core/validation.js';
import type { WordPressRuntime } from '../core/transport.js';

/**
 * WordPress settings resource.
 * 
 * @example
 * ```typescript
 * const settings = SettingsResource.create(runtime);
 * const siteSettings = await settings.getSettings();
 * await settings.updateSettings({ title: 'My Site' });
 * ```
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
  async getSettings(requestOptions?: WordPressRequestOverrides): Promise<WordPressSettings> {
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
   */
  async updateSettings<TSettings = WordPressSettings>(
    input: Partial<WordPressSettings> & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TSettings> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TSettings> {
    this.assertAuthenticated();

    const resolved = resolveMutationArguments<TSettings>(
      responseSchemaOrRequestOptions,
      requestOptions,
    );

    const { data, response } = await this.runtime.request<unknown>(applyRequestOverrides({
      endpoint: this.endpoint,
      method: 'POST',
      body: compactPayload(input),
    }, resolved.requestOptions));

    throwIfWordPressError(response, data);

    return validateWithStandardSchema(
      resolved.responseSchema ?? (settingsSchema as WordPressStandardSchema<TSettings>),
      data,
      'Settings response validation failed',
    );
  }
}
