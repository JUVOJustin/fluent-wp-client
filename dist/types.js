/**
 * Converts one filter object to WordPress API query params.
 */
export function filterToParams(filter, options = {}) {
    const params = {};
    for (const [key, value] of Object.entries(filter)) {
        if (value === undefined || value === null) {
            continue;
        }
        const apiKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (Array.isArray(value)) {
            params[apiKey] = value.map((item) => String(item)).join(',');
            continue;
        }
        if (typeof value === 'boolean') {
            params[apiKey] = value ? 'true' : 'false';
            continue;
        }
        params[apiKey] = String(value);
    }
    if (options.applyPerPageDefault !== false && params.per_page === undefined) {
        params.per_page = '100';
    }
    return params;
}
/**
 * Removes undefined values before a payload is sent to WordPress.
 */
export function compactPayload(input) {
    const payload = {};
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined) {
            continue;
        }
        payload[key] = value;
    }
    return payload;
}
