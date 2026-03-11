import type { WordPressSettings } from '../schemas.js';

/**
 * Settings API methods factory for typed read operations.
 */
export function createSettingsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  hasAuth: () => boolean,
) {
  return {
    /**
     * Gets WordPress site settings.
     */
    async getSettings(): Promise<WordPressSettings> {
      if (!hasAuth()) {
        throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
      }

      return fetchAPI<WordPressSettings>('/settings');
    },
  };
}
