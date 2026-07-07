import { fetchWithAuth } from './http';
import config from '../config';

const BASE_URL = config.API_URL + '/api';

const cameraCredentialsApi = {
  /**
   * Fetch all camera locations (CCTV types) from the locations endpoint.
   * Returns the full location array so the UI can list every camera.
   */
  getAllCameraLocations: async () => {
    try {
      const response = await fetchWithAuth(`${BASE_URL}/locations`);
      const locations = await response.json();
      if (!Array.isArray(locations)) return [];
      // asset_type_id in the API response is the lowercase string label from the asset_types table.
      // Include both Mainline CCTV ('cctv', type_id=1) and RSA Camera ('rsa camera', type_id=5).
      return locations
        .filter((loc) => loc.asset_type_id === 'cctv' || loc.asset_type_id === 'rsa camera')
        .map((loc) => ({
          ...loc,
          type_id: loc.asset_type_id === 'rsa camera' ? 5 : (loc.type_id ?? 1),
        }));
    } catch (error) {
      console.error('Error fetching camera locations:', error);
      throw error;
    }
  },

  /**
   * Fetch only locations that have custom credentials set in the DB.
   * Returns an array of { location_id, ip, system, camera_username, camera_password }.
   */
  getCustomCredentials: async () => {
    try {
      const response = await fetchWithAuth(`${BASE_URL}/camera-credentials`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom credentials:', error);
      throw error;
    }
  },

  /**
   * Get credentials for a single location by ID.
   */
  getCredentialsById: async (locationId) => {
    try {
      const response = await fetchWithAuth(`${BASE_URL}/camera-credentials/${locationId}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching credentials for location ${locationId}:`, error);
      throw error;
    }
  },

  /**
   * Save credentials and/or camera hardware info for a location.
   * - Pass non-empty strings to set custom credentials.
   * - Pass null/empty for both to revert to global defaults (DB stores NULL).
   * - Pass undefined for password to keep the existing password unchanged.
   * - Pass noAuth=true to mark the camera as requiring no authentication.
   *
   * @param {number}      locationId  - locations.id
   * @param {string|null} username
   * @param {string|null|undefined} password  undefined = do not change existing password
   * @param {boolean}     noAuth  when true, clears creds and sets camera_no_auth=true
   * @param {string|null} system  camera brand slug (HIK / BOSCH / DAHUA / 0 / OTHER)
   * @param {string|null} model   specific camera model string
   */
  saveCredentials: async (locationId, username, password, noAuth = false, system = undefined, model = undefined) => {
    try {
      let body;
      if (noAuth) {
        body = { camera_no_auth: true };
      } else {
        body = { camera_username: username || null, camera_no_auth: false };
        if (password !== undefined) {
          body.camera_password = password || null;
        }
      }
      // Always persist system/model when provided
      if (system !== undefined) body.system = system || null;
      if (model !== undefined) body.model = model || null;
      const response = await fetchWithAuth(`${BASE_URL}/locations/${locationId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (error) {
      console.error(`Error saving credentials for location ${locationId}:`, error);
      throw error;
    }
  },
};

export default cameraCredentialsApi;
