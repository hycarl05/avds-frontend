import { fetchWithAuth } from './http';
import config from '../config';
import axios from 'axios';

const API_URL = config.API_URL + '/api/services';

// Helper function to get CSRF cookie
const getCsrfCookie = async () => {
  try {
    await axios.get(`${config.API_URL}sanctum/csrf-cookie`, {
      withCredentials: true,
    });
  } catch (error) {
    console.error('Error fetching CSRF cookie:', error);
  }
};

export const serviceApi = {
  // Get all services
  getAll: async () => {
    try {
      const response = await fetchWithAuth(API_URL);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching services:', error);
      throw error;
    }
  },

  // Get single service by ID
  getById: async (id) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/${id}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching service:', error);
      throw error;
    }
  },

  // Create new service
  create: async (serviceData) => {
    try {
      // Get CSRF cookie first
      await getCsrfCookie();
      
      const response = await fetchWithAuth(API_URL, {
        method: 'POST',
        body: JSON.stringify(serviceData),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  },

  // Update service
  update: async (id, serviceData) => {
    try {
      // Get CSRF cookie first
      await getCsrfCookie();
      
      const response = await fetchWithAuth(`${API_URL}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(serviceData),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating service:', error);
      throw error;
    }
  },

  // Delete service
  delete: async (id) => {
    try {
      // Get CSRF cookie first
      await getCsrfCookie();
      
      const response = await fetchWithAuth(`${API_URL}/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  },
};

export default serviceApi;
