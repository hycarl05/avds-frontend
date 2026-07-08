
import axios from "axios";
import logger from "../utils/logger";
import config from "../config";

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Add axios request interceptor: auth token + CSRF for state-changing requests
axios.interceptors.request.use(
    async (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        const method = (config.method || 'get').toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            try {
                let xsrf = getCookie('XSRF-TOKEN');
                if (!xsrf) {
                    await fetch(`${config.API_URL || ''}/sanctum/csrf-cookie`, { credentials: 'include' });
                    xsrf = getCookie('XSRF-TOKEN');
                }
                if (xsrf) config.headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
            } catch (e) {
                logger.error('Axios CSRF token error', e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Prevent multiple simultaneous 401s from triggering multiple redirects
let _redirectingToLogin = false;

// Add axios response interceptor to handle 401 errors
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (!_redirectingToLogin) {
                _redirectingToLogin = true;
                localStorage.removeItem('authToken');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = "/login";
                }
                // Reset flag after navigation settles
                setTimeout(() => { _redirectingToLogin = false; }, 5000);
            }
        }
        return Promise.reject(error);
    }
);

/**
 * Redirect to login page and clear local storage
 */
const redirectToLogin = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("user");

    if (!window.location.pathname.includes('/login')) {
        console.log('🔄 Redirecting to login page');
        window.location.href = "/login";
    }
};

/**
 * Check if user is authenticated
 */
export const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        redirectToLogin();
        return null;
    }

    try {
        const response = await axios.get(`${config.API_URL}/api/user`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        return null;
    }
};

/** Ensure CSRF cookie is set and return token for state-changing requests (Laravel 419 fix) */
async function ensureCsrfToken() {
    const existing = getCookie('XSRF-TOKEN');
    if (existing) return existing;
    const csrfUrl = `${config.API_URL || ''}/sanctum/csrf-cookie`;
    const res = await fetch(csrfUrl, { method: 'GET', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get CSRF cookie');
    const token = getCookie('XSRF-TOKEN');
    if (!token) throw new Error('CSRF token not found after cookie request');
    return token;
}

/**
 * True when the request is to the app's API (api/* routes are excluded from CSRF on the backend).
 * For cross-origin (e.g. SPA on ccs.plus.com.my, API on api.ccs.plus.com.my), the CSRF cookie
 * set by sanctum/csrf-cookie is not readable by the SPA, so we skip CSRF for API requests.
 */
function isApiRequest(url) {
    const base = (config.API_URL || '').replace(/\/$/, '');
    if (!base) return false;
    const normalized = url.replace(/\/$/, '');
    return normalized === base || normalized.startsWith(base + '/api');
}

/**
 * Authenticated fetch wrapper using Bearer tokens.
 * For POST/PUT/PATCH/DELETE to same-origin routes, fetches CSRF cookie and sends X-XSRF-TOKEN.
 * For requests to the API base (api/*), CSRF is skipped because the backend excludes api/* from verification.
 */
export const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        redirectToLogin();
        throw new Error("No auth token found");
    }

    const method = (options.method || 'GET').toUpperCase();
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
    };

    // Only require CSRF for state-changing methods when NOT calling the API (api/* is excluded from CSRF server-side)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !isApiRequest(url)) {
        try {
            const xsrfToken = await ensureCsrfToken();
            headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
        } catch (e) {
            logger.error('CSRF token error', e);
            throw new Error('Failed to get CSRF token. Please refresh and try again.');
        }
    }

    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include', // Required for CORS with cookies
            headers,
        });

        // Don't throw on 422 (validation errors) - let caller handle it
        if (!response.ok && response.status !== 422) {
            if (response.status === 401) {
                // Only clear session on genuine 401 — not on 5xx / network errors
                redirectToLogin();
                throw new Error("Unauthorized: Invalid or expired token");
            }
            // For 5xx or other errors, throw without clearing the session
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    } catch (error) {
        logger.error('Fetch error:', error);
        throw error;
    }
};

export const axiosGet = async (url, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
    };

    try {
        const response = await axios.get(url, {
            headers,
            ...options,
            withCredentials: true, // CRITICAL: Send cookies
        });
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        throw error;
    }
};

export const axiosPost = async (url, data = {}, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
    };

    try {
        const response = await axios.post(url, data, {
            headers,
            ...options,
            withCredentials: true, // CRITICAL: Send cookies
        });
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        throw error;
    }
};

export const axiosPut = async (url, data = {}, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
    };

    try {
        const response = await axios.put(url, data, {
            headers,
            ...options,
            withCredentials: true, // CRITICAL: Send cookies
        });
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        throw error;
    }
};

export const axiosPatch = async (url, data = {}, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
    };

    try {
        const response = await axios.patch(url, data, {
            headers,
            ...options,
            withCredentials: true,
        });
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        throw error;
    }
};

export const axiosDelete = async (url, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
    };

    try {
        const response = await axios.delete(url, {
            headers,
            ...options,
            withCredentials: true, // CRITICAL: Send cookies
        });
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            redirectToLogin();
        }
        throw error;
    }
};
