import { fetchWithAuth } from './http';
import config from '../config';
import axios from 'axios';

const API_URL = config.API_URL + '/api/users';

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

export const userApi = {
  // Get all users
  getAll: async () => {
    try {
      const response = await fetchWithAuth(API_URL);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get single user by ID
  getById: async (id) => {
    try {
      const response = await fetchWithAuth(`${API_URL}/${id}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },

  // Create new user
  create: async (userData) => {
    try {
      // Get CSRF cookie first
      await getCsrfCookie();
      
      const response = await fetchWithAuth(API_URL, {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Update user
  update: async (id, userData) => {
    try {
      // Get CSRF cookie first
      await getCsrfCookie();
      
      const response = await fetchWithAuth(`${API_URL}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
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
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Get user roles
  getRoles: async () => {
    try {
      const response = await fetchWithAuth(`${config.API_URL}/api/roles`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error;
    }
  },

  // Save user's camera grid preferences
  saveCameraPreferences: async (preferences) => {
    try {
      await getCsrfCookie();
      
      const response = await fetchWithAuth(`${API_URL}/camera-preferences`, {
        method: 'POST',
        body: JSON.stringify(preferences),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error saving camera preferences:', error);
      throw error;
    }
  },

  // Get user's camera grid preferences
  getCameraPreferences: async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/camera-preferences`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching camera preferences:', error);
      throw error;
    }
  }
};

export default userApi;
