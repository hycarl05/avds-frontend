const config = {};

// Automatically include all VITE_ variables
for (const key in import.meta.env) {
    if (key.startsWith('VITE_')) {
        // Convert VITE_APP_NAME to APP_NAME for cleaner access
        const configKey = key.replace('VITE_', '');
        config[configKey] = import.meta.env[key] || '';
    }
}

// Strip trailing slashes from URL values to prevent double-slash issues
['API_URL', 'APP_BASE_URL', 'STREAMING_SERVER_URL', 'STREAM_BASE_URL'].forEach(key => {
    if (config[key]) config[key] = config[key].replace(/\/+$/, '');
});

export default config;
