import type { WordPressSettings } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';

/**
 * Settings API methods factory for typed read operations.
 */
export function createSettingsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>, options?: WordPressRequestOverrides) => Promise<T>,
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
