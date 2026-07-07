import { API_BASE_URL } from '../config/constants';

class LocationApiService {
  constructor() {
    this.baseURL = API_BASE_URL || 'http://127.0.0.1:8000';
  }

  // Generic request handler
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}/api${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      // Handle empty responses (like 204 No Content)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Get all locations or incremental updates
  async getLocations(timestamp = '') {
    return this.request(`/locations${timestamp}`);
  }

  // Get single location
  async getLocation(id) {
    return this.request(`/locations/${id}`);
  }

  // Create new location
  async createLocation(locationData) {
    return this.request('/locations', {
      method: 'POST',
      body: JSON.stringify(this.prepareLocationData(locationData))
    });
  }

  // Update existing location
  async updateLocation(id, locationData) {
    return this.request(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(this.prepareLocationData(locationData))
    });
  }

  // Delete location
  async deleteLocation(id) {
    return this.request(`/locations/${id}`, {
      method: 'DELETE'
    });
  }

  // Prepare location data for API
  prepareLocationData(data) {
    return {
      name: data.name,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      popUp: data.description || '',
      status: data.status,
      type: data.type ?? 'cctv',
      zone: data.zone
    };
  }
}

export const locationApi = new LocationApiService();
