/**
 * Streaming utilities
 * Functions for handling streaming operations and validation
 */

import { ASSET_TYPE_CONFIG, STREAM_TYPES } from '../constants/assetConstants';
import config from '../config';
import axios from 'axios';

/**
 * Generate stream URL for an asset
 * @param {Object} asset - Asset object
 * @param {string} serverUrl - Streaming server URL (optional)
 * @returns {string} Stream URL
 */
export const generateStreamUrl = async (asset, serverUrl) => {
  if (!asset?.ipAddress) throw new Error('Asset IP address is required for streaming');
  
  // Get system type from database
  const systemType = asset.system || 'OTHER';
  
  // API call to Python server (trigger conversion)
  const streamingServerUrl = config.STREAMING_SERVER_URL;
  const cameraEndpoint = `${streamingServerUrl}/camera/${systemType}/${asset.ipAddress}`;
  
  // HLS base URL (Vite dev server - serve static files)
  const hlsBaseUrl = serverUrl || config.API_URL;
  
  try {
    const resp = await axios.get(cameraEndpoint, { timeout: 8000 });
    if (resp.data?.hls_url) {
      let url = resp.data.hls_url.startsWith('http') ? resp.data.hls_url : `${hlsBaseUrl}${resp.data.hls_url}`;
      
      // Add cache busting parameter to force fresh playlist load
      const cacheBuster = Date.now();
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}rand=${cacheBuster}`;

      return url;
    }
  } catch (e) {
    console.warn('generateStreamUrl: camera endpoint failed, falling back to direct HLS path', e?.message);
  }
  
  // Fallback with cache buster
  const cacheBuster = Date.now();
  return `${hlsBaseUrl}/stream/${asset.ipAddress}/index.m3u8?rand=${cacheBuster}`;
};

/**
 * Check if asset supports streaming
 * @param {Object} asset - Asset object
 * @returns {boolean} Whether asset supports streaming
 */
export const canAssetStream = (asset) => {
  const config = ASSET_TYPE_CONFIG[asset.type?.toLowerCase()];
  return config?.displayType === 'video';
};

/**
 * Validate streaming requirements
 * @param {Object} asset - Asset object
 * @returns {Object} Validation result
 */
export const validateStreamingRequirements = (asset) => {
  const errors = [];
  
  if (!asset) {
    errors.push('Asset is required');
    return { isValid: false, errors };
  }
  
  if (!canAssetStream(asset)) {
    errors.push(`Asset type ${asset.type} does not support streaming`);
  }
  
  if (!asset.ipAddress) {
    errors.push('Asset IP address is required for streaming');
  }
  
  if (!asset.id) {
    errors.push('Asset ID is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Create stream data object
 * @param {Object} asset - Asset object
 * @param {string} streamUrl - Stream URL
 * @param {string} sourceType - Stream source type
 * @returns {Object} Stream data object
 */
export const createStreamData = (asset, streamUrl, sourceType = STREAM_TYPES.HLS) => {
  return {
    streamUrl,
    cameraName: asset.name,
    startTime: new Date().toISOString(),
    sourceType,
    assetId: asset.id,
    assetType: asset.type,
  };
};

/**
 * Format stream duration
 * @param {string} startTime - Stream start time ISO string
 * @returns {string} Formatted duration
 */
export const formatStreamDuration = (startTime) => {
  const start = new Date(startTime);
  const now = new Date();
  const duration = Math.floor((now - start) / 1000); // Duration in seconds
  
  if (duration < 60) {
    return `${duration}s`;
  } else if (duration < 3600) {
    const minutes = Math.floor(duration / 60);
    return `${minutes}m`;
  } else {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Get stream status
 * @param {Map} activeStreams - Map of active streams
 * @param {string} assetId - Asset ID
 * @returns {Object} Stream status object
 */
export const getStreamStatus = (activeStreams, assetId) => {
  const stream = activeStreams.get(assetId);
  
  if (!stream) {
    return {
      isActive: false,
      status: 'inactive',
      duration: null,
      streamUrl: null,
    };
  }
  
  return {
    isActive: true,
    status: 'online',
    duration: formatStreamDuration(stream.startTime),
    streamUrl: stream.streamUrl,
    startTime: stream.startTime,
    sourceType: stream.sourceType,
  };
};

/**
 * Batch stream operations
 * @param {Array} assets - Array of assets
 * @param {Function} streamOperation - Stream operation function (start/stop)
 * @returns {Promise} Promise that resolves when all operations complete
 */
export const batchStreamOperation = async (assets, streamOperation) => {
  const operations = assets
    .filter(asset => canAssetStream(asset))
    .map(async (asset) => {
      try {
        await streamOperation(asset);
      } catch (error) {
        console.error(`Stream operation failed for asset ${asset.id}:`, error);
      }
    });
  
  return Promise.allSettled(operations);
};

/**
 * Get streaming statistics
 * @param {Map} activeStreams - Map of active streams
 * @param {Array} assets - Array of all assets
 * @returns {Object} Streaming statistics
 */
export const getStreamingStats = (activeStreams, assets) => {
  const streamableAssets = assets.filter(canAssetStream);
  
  return {
    totalStreamable: streamableAssets.length,
    activeStreams: activeStreams.size,
    inactiveStreams: streamableAssets.length - activeStreams.size,
    streamingPercentage: streamableAssets.length > 0 
      ? Math.round((activeStreams.size / streamableAssets.length) * 100) 
      : 0,
  };
};

/**
 * Clean up inactive streams
 * @param {Map} activeStreams - Map of active streams
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Map} Cleaned up streams map
 */
export const cleanupInactiveStreams = (activeStreams, maxAge = 30 * 60 * 1000) => {
  const now = new Date();
  const cleanedStreams = new Map();
  
  for (const [assetId, streamData] of activeStreams) {
    const streamAge = now - new Date(streamData.startTime);
    
    if (streamAge <= maxAge) {
      cleanedStreams.set(assetId, streamData);
    }
  }
  
  return cleanedStreams;
};
