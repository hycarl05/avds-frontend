/**
 * Secure Logger Utility
 * Only logs to console in development mode
 * In production, errors are sent to error tracking service (future implementation)
 */

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Log general information (only in development)
     */
    log: (...args) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Log errors (development: console, production: error tracking service)
     */
    error: (...args) => {
        if (isDev) {
            console.error(...args);
        } else {
            // TODO: Send to error tracking service (Sentry, Rollbar, etc.)
            // Example: Sentry.captureException(args[0]);
        }
    },

    /**
     * Log warnings (only in development)
     */
    warn: (...args) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    /**
     * Log debug information (only in development)
     */
    debug: (...args) => {
        if (isDev) {
            console.debug(...args);
        }
    },

    /**
     * Log information (only in development)
     */
    info: (...args) => {
        if (isDev) {
            console.info(...args);
        }
    },

    /**
     * Log success messages (only in development)
     */
    success: (...args) => {
        if (isDev) {
            console.info(...args);
        }
    },
};

export default logger;
