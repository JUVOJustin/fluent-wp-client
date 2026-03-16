import type { WordPressSettings } from '../schemas.js';
import type { WordPressRequestOverrides } from '../client-types.js';
import { createWordPressClientError } from '../core/errors.js';

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
        throw createWordPressClientError({
          kind: 'AUTH_ERROR',
          message: 'Authentication required for /settings endpoint. Configure auth in client options.',
          operation: 'getSettings',
          method: 'GET',
          endpoint: '/settings',
        });
      }

      return fetchAPI<WordPressSettings>('/settings', undefined, requestOptions);
    },
  };
}
