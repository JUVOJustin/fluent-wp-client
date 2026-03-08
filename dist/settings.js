/**
 * Settings API methods factory for typed read operations.
 */
export function createSettingsMethods(fetchAPI, hasAuth) {
    return {
        /**
         * Gets WordPress site settings.
         */
        async getSettings() {
            if (!hasAuth()) {
                throw new Error('Authentication required for /settings endpoint. Configure auth in client options.');
            }
            return fetchAPI('/settings');
        },
    };
}
