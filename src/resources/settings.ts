import type { WordPressSettings } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import { settingsSchema } from '../standard-schemas.js';
import { compactPayload } from '../core/params.js';
import { applyRequestOverrides } from '../core/request-overrides.js';
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
   * Gets WordPress site settings.
   */
  async getSettings(requestOptions?: WordPressRequestOverrides): Promise<WordPressSettings> {
    if (!this.runtime.hasAuth()) {
      throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
    }

    return this.runtime.fetchAPI<WordPressSettings>(this.endpoint, undefined, requestOptions);
  }

  /**
   * Updates WordPress site settings.
   */
  async updateSettings<TSettings = WordPressSettings>(
    input: Partial<WordPressSettings> & Record<string, unknown>,
    responseSchemaOrRequestOptions?: WordPressStandardSchema<TSettings> | WordPressRequestOverrides,
    requestOptions?: WordPressRequestOverrides,
  ): Promise<TSettings> {
    if (!this.runtime.hasAuth()) {
      throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
    }

    let resolved: { responseSchema?: WordPressStandardSchema<TSettings>; requestOptions?: WordPressRequestOverrides };

    if (responseSchemaOrRequestOptions && typeof responseSchemaOrRequestOptions === 'object' && '~standard' in responseSchemaOrRequestOptions) {
      resolved = {
        responseSchema: responseSchemaOrRequestOptions as WordPressStandardSchema<TSettings>,
        requestOptions,
      };
    } else if (!responseSchemaOrRequestOptions) {
      resolved = { responseSchema: undefined, requestOptions };
    } else {
      resolved = {
        responseSchema: undefined,
        requestOptions: { ...responseSchemaOrRequestOptions, ...requestOptions },
      };
    }

    const { data, response } = await this.runtime.request<TSettings>(applyRequestOverrides({
      endpoint: this.endpoint,
      method: 'POST',
      body: compactPayload(input),
    }, resolved.requestOptions, 'Settings update options'));

    if (response.status >= 400) {
      throw new Error(`Settings update failed: ${response.statusText}`);
    }

    if (resolved.responseSchema) {
      const { validateWithStandardSchema } = await import('../core/validation.js');
      return validateWithStandardSchema(resolved.responseSchema, data, 'Settings response validation failed');
    }

    return data;
  }
}

/**
 * Legacy factory function - now delegates to SettingsResource.create().
 * @deprecated Use SettingsResource.create() or new SettingsResource() directly.
 */
export function createSettingsMethods(runtime: WordPressRuntime): SettingsResource {
  return SettingsResource.create(runtime);
}

/**
 * @deprecated Import SettingsMethods from '../types/resources.js' instead.
 */
export interface SettingsMethods extends SettingsResource {}
