import axios from 'axios';
import config from "../config";
import { axiosGet } from "../services/http";
import logger from "../utils/logger";

// API Base URLs
const ASSET_API_URL = config.API_URL + '/api';
const STREAMING_SERVER_URL = config.STREAMING_SERVER_URL;

// Cache configuration
const CACHE_CONFIG = {
  COUNTS_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Simple in-memory cache for asset counts
let countsCache = null;
let countsCacheTime = null;

export const api = {
  // Asset Management APIs
  assets: {
    /**
     * Get all assets with optional filters
     * @param {Object} filters - Optional filters (type, region, status, search)
     */
    getAll: (filters = {}) => {
      const params = new URLSearchParams();
      
      if (filters.type) params.append('type', filters.type);
      if (filters.region && filters.region !== 'All Regions') params.append('zone', filters.region);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const queryString = params.toString();
      const url = `${ASSET_API_URL}/assets${queryString ? `?${queryString}` : ''}`;
      
      return axiosGet(url);
    },

    getByType: (typeId) => axiosGet(`${ASSET_API_URL}/assets?type=${typeId}`),

    /**
     * Get asset counts with caching and retry logic
     * @param {boolean} forceRefresh - Force refresh cache
     * @returns {Promise<Object>} Response with counts data
     */
    getCounts: async (forceRefresh = false) => {
      const now = Date.now();
      
      // Return cached data if available and not expired
      if (!forceRefresh && countsCache && countsCacheTime && (now - countsCacheTime < CACHE_CONFIG.COUNTS_DURATION)) {
        logger.info('Returning cached asset counts', {
          cacheAge: Math.round((now - countsCacheTime) / 1000) + 's',
          expiresIn: Math.round((CACHE_CONFIG.COUNTS_DURATION - (now - countsCacheTime)) / 1000) + 's'
        });
        return { data: countsCache };
      }

      // Retry logic for failed requests
      let lastError = null;
      for (let attempt = 1; attempt <= CACHE_CONFIG.MAX_RETRIES; attempt++) {
        try {
          logger.info(`Fetching asset counts (attempt ${attempt}/${CACHE_CONFIG.MAX_RETRIES})`);
          
          const response = await axiosGet(`${ASSET_API_URL}/assets/counts`);
          
          // Validate response structure
          if (!response.data || typeof response.data !== 'object') {
            throw new Error('Invalid response format from counts API');
          }

          // Update cache
          countsCache = response.data;
          countsCacheTime = now;
          
          logger.success('Asset counts fetched successfully', {
            cached: true,
            timestamp: new Date(now).toISOString()
          });
          
          return response;
        } catch (error) {
          lastError = error;
          
          logger.warn(`Asset counts fetch failed (attempt ${attempt}/${CACHE_CONFIG.MAX_RETRIES})`, {
            error: error.message,
            status: error.response?.status
          });

          // Don't retry on authentication errors
          if (error.response?.status === 401 || error.response?.status === 403) {
            break;
          }

          // Wait before retrying (except on last attempt)
          if (attempt < CACHE_CONFIG.MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.RETRY_DELAY * attempt));
          }
        }
      }

      // Return cached data if available, even if expired
      if (countsCache) {
        logger.warn('Using stale cached counts due to API error', {
          error: lastError?.message,
          cacheAge: Math.round((now - countsCacheTime) / 1000) + 's'
        });
        return { data: countsCache };
      }
      
      // No cache available, throw the error
      throw lastError;
    },

    /**
     * Clear the counts cache manually
     */
    clearCache: () => {
      countsCache = null;
      countsCacheTime = null;
    },

    getById: (id) => axiosGet(`${ASSET_API_URL}/assets/${id}`),
    create: (data) => {
      // Clear cache after create
      countsCache = null;
      countsCacheTime = null;
      return axios.post(`${ASSET_API_URL}/assets`, data);
    },
    update: (id, data) => {
      // Clear cache after update
      countsCache = null;
      countsCacheTime = null;
      return axios.put(`${ASSET_API_URL}/assets/${id}`, data);
    },
    delete: (id) => {
      // Clear cache after delete
      countsCache = null;
      countsCacheTime = null;
      return axios.delete(`${ASSET_API_URL}/assets/${id}`);
    },
  },

  // Streaming Server APIs
  streaming: {
    // Server health and status
    checkServerHealth: () => axios.get(`${STREAMING_SERVER_URL}/api/health`),
    getActiveStreams: () => axios.get(`${STREAMING_SERVER_URL}/api/streams`),

    // Stream control
    startStream: (assetId, config) =>
      axios.post(`${STREAMING_SERVER_URL}/api/stream/start/${assetId}`, config),

    stopStream: (assetId) =>
      axios.post(`${STREAMING_SERVER_URL}/api/stream/stop/${assetId}`),

    // Webcam testing
    testWebcam: () => axios.get(`${STREAMING_SERVER_URL}/api/webcam/test`),
    listWebcamDevices: () => axios.get(`${STREAMING_SERVER_URL}/api/webcam/devices`)
  }
};

// Helper function to handle API errors consistently
export const handleApiError = (error, context = '') => {
  console.error(`API Error ${context}:`, error);

  if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
    return {
      type: 'CONNECTION_ERROR',
      message: 'Cannot connect to server. Please check if the service is running.',
      details: error.message
    };
  }

  if (error.response) {
    return {
      type: 'SERVER_ERROR',
      status: error.response.status,
      message: error.response.data?.error || error.response.data?.message || 'Server error occurred',
      details: error.response.data
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred',
    details: error
  };
};
