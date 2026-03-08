import type { WordPressSettings } from './schemas.js';
/**
 * Settings API methods factory for typed read operations.
 */
export declare function createSettingsMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>, hasAuth: () => boolean): {
    /**
     * Gets WordPress site settings.
     */
    getSettings(): Promise<WordPressSettings>;
};
