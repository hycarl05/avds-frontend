import { fetchWithAuth } from './http';
import config from '../config';

const API_URL = config.API_URL + '/api/rtsp-models';

export const rtspModelApi = {
  // Get all RTSP models
  getAll: async () => {
    try {
      const response = await fetchWithAuth(API_URL);
      return response.data || response;
    } catch (error) {
      console.error('Error fetching RTSP models:', error);
      throw error;
    }
  },

  // Get single RTSP model by ID
  getById: async (id) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/${id}`);
      return response.data || response;
    } catch (error) {
      console.error('Error fetching RTSP model:', error);
      throw error;
    }
  },

  // Create new RTSP model
  create: async (modelData) => {
    try {
      const response = await fetchWithAuth(API_URL, {
        method: 'POST',
        body: JSON.stringify(modelData),
      });
      return response.data || response;
    } catch (error) {
      console.error('Error creating RTSP model:', error);
      throw error;
    }
  },

  // Update RTSP model
  update: async (id, modelData) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(modelData),
      });
      return response.data || response;
    } catch (error) {
      console.error('Error updating RTSP model:', error);
      throw error;
    }
  },

  // Delete RTSP model
  delete: async (id) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/${id}`, {
        method: 'DELETE',
      });
      return response.data || response;
    } catch (error) {
      console.error('Error deleting RTSP model:', error);
      throw error;
    }
  },

  // Test RTSP connection
  testConnection: async (rtspUrl) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/test-connection`, {
        method: 'POST',
        body: JSON.stringify({ rtsp_url: rtspUrl }),
      });
      return response.data || response;
    } catch (error) {
      console.error('Error testing RTSP connection:', error);
      throw error;
    }
  }
};

export default rtspModelApi;
