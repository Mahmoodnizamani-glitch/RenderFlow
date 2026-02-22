/**
 * Dynamic Expo config.
 *
 * Extends the static app.json with runtime values injected from
 * EAS build environment variables. The key addition is `extra.apiUrl`
 * which the API client reads at runtime to connect to the correct
 * backend for each build profile (dev, preview, production).
 *
 * EAS build profiles set the `API_URL` env var in eas.json.
 * For local development, defaults to localhost.
 */

module.exports = ({ config }) => {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';

    return {
        ...config,
        extra: {
            ...config.extra,
            apiUrl,
        },
    };
};
