import config from '../config';
import { axiosGet, axiosPost, axiosPut, axiosDelete } from './http';

const ZONE_API_URL = `${config.API_URL}/api/zones`;

/**
 * Zone API Service
 * Handles all zone-related API calls
 */
export const zoneApi = {
  /**
   * Get all zones
   * @returns {Promise<Array>} List of all zones with location counts (parent zones with subzones)
   */
  getAll: async () => {
    try {
      const response = await axiosGet(ZONE_API_URL);
      const body = response?.data;
      // Backend returns { success: true, data: [...] }
      if (body && Array.isArray(body.data)) return body.data;
      if (Array.isArray(body)) return body;
      return [];
    } catch (error) {
      console.error('Error fetching zones:', error);
      throw handleZoneApiError(error, 'fetching zones');
    }
  },

  /**
   * Get a specific zone by ID
   * @param {number} id - Zone ID
   * @returns {Promise<Object>} Zone details
   */
  getById: async (id) => {
    try {
      const response = await axiosGet(`${ZONE_API_URL}/${id}`);
      // Backend returns {success: true, data: {...}}
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`Error fetching zone ${id}:`, error);
      throw handleZoneApiError(error, `fetching zone ${id}`);
    }
  },

  /**
   * Create a new zone
   * @param {Object} zoneData - Zone data {name: string, parent_id: number}
   * @returns {Promise<Object>} Created zone
   */
  create: async (zoneData) => {
    try {
      const response = await axiosPost(ZONE_API_URL, zoneData);
      return response.data.data;
    } catch (error) {
      console.error('Error creating zone:', error);
      throw handleZoneApiError(error, 'creating zone');
    }
  },

  /**
   * Update an existing zone
   * @param {number} id - Zone ID
   * @param {Object} zoneData - Updated zone data {name: string, parent_id: number}
   * @returns {Promise<Object>} Updated zone
   */
  update: async (id, zoneData) => {
    try {
      const response = await axiosPut(`${ZONE_API_URL}/${id}`, zoneData);
      return response.data.data;
    } catch (error) {
      console.error(`Error updating zone ${id}:`, error);
      throw handleZoneApiError(error, `updating zone ${id}`);
    }
  },

  /**
   * Delete a zone
   * @param {number} id - Zone ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  delete: async (id) => {
    try {
      const response = await axiosDelete(`${ZONE_API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting zone ${id}:`, error);
      throw handleZoneApiError(error, `deleting zone ${id}`);
    }
  },

  /**
   * Get all locations in a specific zone
   * @param {number} id - Zone ID
   * @returns {Promise<Object>} Zone with its locations
   */
  getLocations: async (id) => {
    try {
      const response = await axiosGet(`${ZONE_API_URL}/${id}/locations`);
      // Backend returns {success: true, data: {...}}
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`Error fetching locations for zone ${id}:`, error);
      throw handleZoneApiError(error, `fetching locations for zone ${id}`);
    }
  },

  /**
   * Get zone statistics (location counts by status)
   * @returns {Promise<Array>} Zone statistics
   */
  getStatistics: async () => {
    try {
      const response = await axiosGet(`${ZONE_API_URL}/statistics`);
      // Backend returns {success: true, data: [...]}
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching zone statistics:', error);
      throw handleZoneApiError(error, 'fetching zone statistics');
    }
  },
};

/**
 * Handle zone API errors consistently
 * @param {Error} error - The error object
 * @param {string} context - Context of the error
 * @returns {Error} Formatted error
 */
const handleZoneApiError = (error, context) => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.message || 
                   error.response.data?.error || 
                   `Server error while ${context}`;
    const newError = new Error(message);
    newError.status = error.response.status;
    newError.data = error.response.data;
    return newError;
  } else if (error.request) {
    // Request made but no response
    const newError = new Error(`No response from server while ${context}`);
    newError.status = 0;
    return newError;
  } else {
    // Something else happened
    const newError = new Error(`Error ${context}: ${error.message}`);
    return newError;
  }
};

export default zoneApi;
