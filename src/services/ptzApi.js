// ptzApi.js
import config from '../config';

/**
 * PTZ (Pan-Tilt-Zoom) API Service
 * All PTZ commands are routed through the Laravel backend (port 8000).
 * Endpoint: POST /api/ptz
 * Body: { action, ip, username?, password?, profileToken?, presetToken?, presetName? }
 */

// Use Laravel API base — never the streaming server directly (avoids CORS).
const apiBase = (config.API_URL || 'http://localhost:8000/').replace(/\/$/, '');
const PTZ_ENDPOINT = `${apiBase}/api/ptz`;

// Map frontend direction names to the action strings the Laravel controller accepts.
const DIRECTION_TO_ACTION = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  zoom_in: 'zoomin',
  zoom_out: 'zoomout',
  zoomin: 'zoomin',
  zoomout: 'zoomout',
  stop: 'stop',
};

/**
 * Internal helper — POST to Laravel /api/ptz.
 * Only sends Authorization header; no XSRF token (Laravel api/* routes are CSRF-exempt).
 */
async function postPtz(payload) {
  const response = await fetch(PTZ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`PTZ error (${response.status}): ${text}`);
  }

  return text;
}

export const ptzApi = {
  /**
   * Send PTZ move command to camera via Laravel.
   * @param {string} _system - Unused (Laravel uses ONVIF for all cameras)
   * @param {string} ip - Camera IP address
   * @param {string} direction - up | down | left | right | zoom_in | zoom_out | stop
   * @param {Object} credentials - Optional { username, password, profileToken }
   */
  sendCommand: async (_system, ip, direction, credentials = {}) => {
    if (!ip || !direction) {
      return {
        success: false,
        error: 'Missing ip or direction',
        message: 'PTZ command requires ip and direction',
      };
    }

    const action = DIRECTION_TO_ACTION[direction] || direction;

    try {
      const text = await postPtz({ action, ip, ...credentials });
      return {
        success: true,
        data: text,
        message: `PTZ command ${action} executed successfully`,
      };
    } catch (error) {
      console.error(`PTZ command ${direction} failed:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to execute PTZ command ${direction}`,
      };
    }
  },

  /**
   * Stop PTZ movement via Laravel.
   * @param {string} _system - Unused
   * @param {string} ip - Camera IP address
   * @param {Object} credentials - Optional { username, password, profileToken }
   */
  stop: async (_system, ip, credentials = {}) => {
    if (!ip) {
      return {
        success: false,
        error: 'Missing ip',
        message: 'PTZ stop requires ip',
      };
    }

    try {
      const text = await postPtz({ action: 'stop', ip, ...credentials });
      return {
        success: true,
        data: text,
        message: 'PTZ stop executed successfully',
      };
    } catch (error) {
      console.error('Failed to stop PTZ:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to stop PTZ',
      };
    }
  },

  /**
   * PTZ preset operations via Laravel.
   * @param {string} _system - Unused
   * @param {string} ip - Camera IP address
   * @param {string} action - 'gotopreset' | 'setpreset' | 'getpresets'
   * @param {string|number} presetToken - Preset token/id (for gotopreset)
   * @param {Object} extras - Optional { presetName, username, password, profileToken }
   */
  preset: async (_system, ip, action, presetToken, extras = {}) => {
    if (!ip || !action) {
      return {
        success: false,
        error: 'Missing ip or action',
        message: 'Preset command requires ip and action',
      };
    }

    try {
      const text = await postPtz({
        action,
        ip,
        ...(presetToken ? { presetToken: String(presetToken) } : {}),
        ...extras,
      });
      return {
        success: true,
        data: text,
        message: `Preset ${action} successful`,
      };
    } catch (error) {
      console.error('Failed to execute PTZ preset:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to execute preset ${action}`,
      };
    }
  },

  /**
   * Get presets from camera via Laravel (ONVIF GetPresets).
   * Returns { success, presets: [{token, name}], data }.
   * Presets are capped at max 10.
   */
  getPresets: async (_system, ip, credentials = {}) => {
    if (!ip) {
      return { success: false, error: 'Missing ip', presets: [] };
    }
    try {
      const text = await postPtz({ action: 'getpresets', ip, ...credentials });

      // Laravel returns "OK: getpresets\n\n<soap xml>".  Strip everything before
      // the XML declaration / SOAP envelope so DOMParser gets valid XML only.
      const xmlStart = (() => {
        const candidates = [
          text.indexOf('<?xml'),
          text.indexOf('<s:Envelope'),
          text.indexOf('<Envelope'),
        ].filter(i => i >= 0);
        return candidates.length > 0 ? Math.min(...candidates) : -1;
      })();
      const xmlText = xmlStart >= 0 ? text.substring(xmlStart) : text;

      // Parse the SOAP XML response — browsers support DOMParser natively.
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');

      // ONVIF cameras may use namespace prefixes; querySelectorAll strips them.
      const presetEls = Array.from(doc.querySelectorAll('Preset'));

      const presets = presetEls
        .map(el => {
          const token = el.getAttribute('token') || '';
          const nameEl = el.querySelector('Name');
          const name = nameEl ? nameEl.textContent.trim() : `Preset ${token}`;
          return { token, name };
        })
        .filter(p => p.token !== '')
        .slice(0, 10); // max 10 presets

      return { success: true, presets, data: text };
    } catch (error) {
      console.error('Failed to get presets:', error);
      return { success: false, error: error.message, presets: [] };
    }
  },

  /**
   * Get PTZ position — not supported via Laravel; returns defaults silently.
   */
  getPosition: async (_system, _ip) => ({
    success: false,
    error: 'Position query not supported',
    data: { pan: 0, tilt: 0, zoom: 1 },
  }),

  /** Backwards-compatible alias. */
  getStatus: async (system, ip) => ptzApi.getPosition(system, ip),
};

export default ptzApi;
