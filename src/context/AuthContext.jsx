import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import '../services/http';
import config from '../config';

const AuthContext = createContext(null);

// Survives Strict Mode remounts so we only run initial auth check once per app load
let initialAuthCheckDone = false;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const justLoggedIn = useRef(false);
    const checkInFlight = useRef(false);

    const checkAuthStatus = useCallback(async () => {
        // Skip if user just logged in - their token is already verified
        if (justLoggedIn.current) {
            setLoading(false);
            return;
        }
        // Prevent concurrent calls (e.g. from AuthProvider + ProtectedRoute or Strict Mode)
        if (checkInFlight.current) return;
        checkInFlight.current = true;
        setLoading(true);

        const token = localStorage.getItem('authToken');
        const headers = {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Retry up to 3 times for transient network / server errors
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await axios.get(`${config.API_URL}/api/user`, {
                    withCredentials: true,
                    timeout: 10000,
                    headers
                });

                if (response.data && response.data.id) {
                    setUser(response.data);
                    setIsAuthenticated(true);
                } else {
                    setUser(null);
                    setIsAuthenticated(false);
                    localStorage.removeItem('authToken');
                }
                checkInFlight.current = false;
                setLoading(false);
                return;
            } catch (error) {
                // Genuine 401 means token is invalid/expired — clear immediately, no retry
                if (error.response?.status === 401) {
                    setUser(null);
                    setIsAuthenticated(false);
                    localStorage.removeItem('authToken');
                    checkInFlight.current = false;
                    setLoading(false);
                    return;
                }
                // Transient error (network down, 500, timeout, CORS) — retry after delay
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        // All retries exhausted due to transient backend error.
        // Keep the user logged in if they already have a token — do NOT evict the session
        // just because the backend is temporarily unavailable.
        if (token) {
            setIsAuthenticated(true);
        } else {
            setUser(null);
            setIsAuthenticated(false);
        }
        checkInFlight.current = false;
        setLoading(false);
    }, []);

    // Check authentication status on mount - once per app load (survives Strict Mode)
    useEffect(() => {
        if (initialAuthCheckDone || justLoggedIn.current) {
            if (justLoggedIn.current) setLoading(false);
            return;
        }
        initialAuthCheckDone = true;
        checkAuthStatus();
    }, [checkAuthStatus]);

    const login = async (credentials) => {
        try {
            console.log('🔐 Starting login...');
            
            // Fetch CSRF cookie first for stateful authentication
            await axios.get(`${config.API_URL}/sanctum/csrf-cookie`, { withCredentials: true });

            // Attempt login - backend now returns token
            const response = await axios.post(
                `${config.API_URL}/api/auth/login`,
                credentials,
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.data.token) {
                console.log('✅ Login successful - token received');
                
                // Save token to localStorage
                localStorage.setItem('authToken', response.data.token);
                
                // Set user data
                if (response.data.user) {
                    setUser(response.data.user);
                    setIsAuthenticated(true);
                    justLoggedIn.current = true;
                }
                
                return { success: true, user: response.data.user };
            }

            return { success: false, message: 'Login failed - no token received' };
        } catch (error) {
            console.error('❌ Login error:', error.response?.data?.message);
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed',
            };
        }
    };

    const logout = async () => {
        console.log('🚪 Logging out...');
        try {
            const token = localStorage.getItem('authToken');
            const headers = {
                'Accept': 'application/json'
            };

            // If we have a token, include it in the logout request
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            await axios.post(
                `${config.API_URL}/api/auth/logout`,
                {},
                { 
                    withCredentials: true,
                    headers
                }
            );
            console.log('✅ Logout successful on server');
        } catch (error) {
            console.error('⚠️ Logout request failed:', error);
            // Continue with local logout even if server request fails
        } finally {
            // Clear authentication state IMMEDIATELY
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
            
            // Reset so next load will run auth check again
            initialAuthCheckDone = false;
            justLoggedIn.current = false;
            
            // Clear token and legacy data
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('userName');
            
            console.log('✅ Local logout complete - user cleared');
        }
    };

    const setUserAndAuth = (userData) => {
        console.log('✅ setUserAndAuth: Setting user and auth state', userData.email);
        setUser(userData);
        setIsAuthenticated(true);
        justLoggedIn.current = true;
        setLoading(false);
    };

    const setAuthenticatedWithFlag = (value) => {
        setIsAuthenticated(value);
        if (value) {
            justLoggedIn.current = true;
        }
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        checkAuthStatus,
        setUser: setUserAndAuth,
        setIsAuthenticated: setAuthenticatedWithFlag,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
