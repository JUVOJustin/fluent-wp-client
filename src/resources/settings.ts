import type { WordPressSettings } from '../schemas.js';
import type { WordPressRequestOverrides } from '../types/resources.js';
import type { SerializedQueryParams } from '../types/resources.js';

/**
 * Settings API methods factory for typed read operations.
 */
export function createSettingsMethods(
  fetchAPI: <T>(endpoint: string, params?: SerializedQueryParams, options?: WordPressRequestOverrides) => Promise<T>,
  hasAuth: () => boolean,
) {
  return {
    /**
     * Gets WordPress site settings.
     */
    async getSettings(requestOptions?: WordPressRequestOverrides): Promise<WordPressSettings> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
      }

      return fetchAPI<WordPressSettings>('/settings', undefined, requestOptions);
    },
  };
}
