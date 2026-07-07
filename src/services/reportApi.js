/**
 * Report data service for API interactions
 */
import { axiosGet } from './http';
import config from '../config';

// Cache for report data
let reportCache = {
  data: null,
  timestamp: null,
  filters: null,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if cache is valid
 */
const isCacheValid = (filters) => {
  if (!reportCache.data || !reportCache.timestamp) return false;
  
  const now = Date.now();
  const isExpired = now - reportCache.timestamp > CACHE_DURATION;
  
  // Check if filters match
  const filtersMatch = JSON.stringify(reportCache.filters) === JSON.stringify(filters);
  
  return !isExpired && filtersMatch;
};

/**
 * Get comprehensive report data from new Reports API
 */
export const getReportData = async (filters = {}) => {
  try {
    // Check cache first
    if (isCacheValid(filters)) {
      console.log('📦 Using cached report data');
      return reportCache.data;
    }
    
    console.log('🔄 Fetching fresh report data from API');
    
    const params = new URLSearchParams();
    if (filters.zone && filters.zone !== 'all') params.append('zone', filters.zone);
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.timeRange) params.append('timeRange', filters.timeRange);
    
    const url = `${config.API_URL}/api/reports${params.toString() ? '?' + params.toString() : ''}`;
    const response = await axiosGet(url);
    
    if (response.data && response.data.success) {
      // Update cache
      reportCache = {
        data: response.data.data,
        timestamp: Date.now(),
        filters: { ...filters },
      };
      
      return response.data.data;
    }
    
    throw new Error('Failed to fetch report data');
  } catch (error) {
    console.error('❌ Error fetching report data:', error);
    throw error;
  }
};

/**
 * Clear report cache
 */
export const clearReportCache = () => {
  reportCache = {
    data: null,
    timestamp: null,
    filters: null,
  };
  console.log('🗑️ Report cache cleared');
};

/**
 * Fetch locations data from API (Legacy - kept for compatibility)
 * @returns {Promise<Object>} Response object with data and status
 */
export const fetchLocations = async () => {
  try {
    const response = await axiosGet(`${config.API_URL}/api/locations`);
    return {
      success: response.status >= 200 && response.status < 300,
      data: Array.isArray(response.data) ? response.data : [],
      status: response.status,
      statusText: response.statusText,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Network Error',
      error: error.response?.data?.message || error.message || 'Failed to fetch locations'
    };
  }
};

/**
 * Fetch assets data from API (Legacy - kept for compatibility)
 * @returns {Promise<Object>} Response object with data and status
 */
export const fetchAssets = async () => {
  try {
    const response = await axiosGet(`${config.API_URL}/api/assets`);
    return {
      success: response.status >= 200 && response.status < 300,
      data: Array.isArray(response.data) ? response.data : [],
      status: response.status,
      statusText: response.statusText,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Network Error',
      error: error.response?.data?.message || error.message || 'Failed to fetch assets'
    };
  }
};

/**
 * Fetch both locations and assets data in parallel (Legacy - kept for compatibility)
 * @returns {Promise<Object>} Combined response with both datasets
 */
export const fetchReportData = async () => {
  console.log('Fetching data from APIs:', `${config.API_URL}/api/locations`, `${config.API_URL}/api/assets`);
  
  const [locationsResult, assetsResult] = await Promise.all([
    fetchLocations(),
    fetchAssets()
  ]);

  const apiErrors = [];
  
  // Process locations result
  if (!locationsResult.success) {
    console.error('❌ Locations API failed:', locationsResult.status, locationsResult.statusText);
    apiErrors.push(`Locations API: ${locationsResult.status} ${locationsResult.statusText}`);
  } else {
    console.log('✅ Fetched locations:', locationsResult.data.length);
  }

  // Process assets result
  if (!assetsResult.success) {
    console.error('❌ Assets API failed:', assetsResult.status, assetsResult.statusText);
    apiErrors.push(`Assets API: ${assetsResult.status} ${assetsResult.statusText}`);
  } else {
    console.log('✅ Fetched assets:', assetsResult.data.length);
  }

  // Determine overall success
  const hasData = locationsResult.data.length > 0 || assetsResult.data.length > 0;
  const allFailed = !locationsResult.success && !assetsResult.success;

  if (!hasData && allFailed) {
    throw new Error(`All API endpoints failed: ${apiErrors.join(', ') || 'No data returned'}`);
  }

  return {
    locations: locationsResult.data,
    assets: assetsResult.data,
    errors: apiErrors,
    partialFailure: apiErrors.length > 0,
    success: true
  };
};
