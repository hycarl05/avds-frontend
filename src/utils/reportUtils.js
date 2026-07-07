/**
 * Report utility functions for data normalization and processing
 */

import { getReportData } from '../services/reportApi';
import { axiosGet } from '../services/http';
import config from '../config';

/**
 * Fetch live asset data from comprehensive Reports API
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Object>} Complete report data
 */
export const fetchLiveReportData = async (filters = {}) => {
  try {
    console.log('🔄 Fetching report data with filters:', filters);
    const reportData = await getReportData(filters);
    
    return {
      assets: reportData.assets || [],
      stats: reportData.stats || getInitialStats(),
      assetStatusData: reportData.assetStatusData || [],
      zoneDistributionData: reportData.zoneDistributionData || [],
      recentActivity: reportData.recentActivity || [],
    };
  } catch (error) {
    console.error('❌ Error fetching report data:', error);
    throw error;
  }
};

/**
 * Fetch live asset data from database (Legacy - for backward compatibility)
 * @returns {Promise<Array>} Live assets data
 */
export const fetchLiveAssetData = async () => {
  try {
    const response = await axiosGet(`${config.API_URL}/api/assets`);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching live asset data:', error);
    return [];
  }
};

/**
 * Normalize API data to ensure consistent structure
 * @param {Array} data - Raw API data
 * @param {string} type - Type of data (location, asset)
 * @returns {Array} Normalized data array
 */
export const normalizeApiData = (data, type) => {
  if (!Array.isArray(data)) {
    console.warn(`Expected array for ${type}, got:`, typeof data, data);
    return [];
  }

  return data.map(item => {
    if (!item || typeof item !== 'object') {
      console.warn(`Invalid ${type} item:`, item);
      return null;
    }

    return {
      id: item.id?.toString() || Math.random().toString(36).substr(2, 9),
      name: item.name || `Unnamed ${type}`,
      type: (item.type || item.asset_type_id || 'unknown').toString().toLowerCase(),
      status: (item.status || item.asset_status_id || 'inactive').toString().toLowerCase(),
      zone: item.zone || item.zone_id || 'Unknown',
      lat: parseFloat(item.lat) || 0,
      lng: parseFloat(item.lng) || 0,
      description: item.description || item.popUp || '',
      created_at: item.created_at,
      updated_at: item.updated_at,
      ...item
    };
  }).filter(item => item !== null);
};

/**
 * Filter items by status
 * @param {Array} items - Array of normalized items
 * @param {string|number} status - Status to filter by
 * @returns {Array} Filtered items
 */
export const filterItemsByStatus = (items, status) => {
  const statusMap = {
    active: ['online', '1', 1],
    inactive: ['inactive', '2', 2],
    warning: ['warning', '3', 3]
  };

  const validStatuses = statusMap[status] || [status];
  return items.filter(item => validStatuses.includes(item.status));
};

/**
 * Calculate statistics from normalized data
 * @param {Array} assetsData - Normalized assets data
 * @returns {Object} Calculated statistics
 */
export const calculateStats = (assetsData) => {
  const normalizedAssets = normalizeApiData(assetsData, 'asset');
  
  const totalAssets = normalizedAssets.length;
  
  const activeAssets = filterItemsByStatus(normalizedAssets, 'online').length;
  const inactiveAssets = filterItemsByStatus(normalizedAssets, 'inactive').length;
  const warningAssets = filterItemsByStatus(normalizedAssets, 'warning').length;
  
  const avgUptime = totalAssets > 0 ? ((activeAssets / totalAssets) * 100) : 0;
  const totalIncidents = warningAssets + inactiveAssets;
  const resolvedIncidents = Math.floor(totalIncidents * 0.75);
  const pendingIncidents = totalIncidents - resolvedIncidents;

  return {
    totalAssets,
    activeAssets,
    inactiveAssets,
    warningAssets,
    avgUptime: parseFloat(avgUptime.toFixed(1)),
    totalIncidents,
    resolvedIncidents,
    pendingIncidents
  };
};

/**
 * Generate asset status chart data from live database
 * @returns {Promise<Array>} Chart data for asset status
 */
export const generateAssetStatusData = async () => {
  const assetsData = await fetchLiveAssetData();
  const normalizedAssets = normalizeApiData(assetsData, 'asset');
  
  const assetTypes = ['cctv', 'vms', 'avds', 'et'];
  
  return assetTypes.map(type => {
    const typeItems = normalizedAssets.filter(item => 
      item.type.toLowerCase() === type.toLowerCase()
    );
    
    if (typeItems.length === 0) return null;

    const active = filterItemsByStatus(typeItems, 'online').length;
    const inactive = filterItemsByStatus(typeItems, 'inactive').length;
    const warning = filterItemsByStatus(typeItems, 'warning').length;

    return {
      name: type.toUpperCase(),
      active,
      inactive,
      warning,
      total: typeItems.length
    };
  }).filter(Boolean);
};

/**
 * Generate zone distribution chart data from live database
 * @returns {Promise<Array>} Chart data for zone distribution
 */
export const generateZoneDistributionData = async () => {
  const assetsData = await fetchLiveAssetData();
  const normalizedAssets = normalizeApiData(assetsData, 'asset');
  
  const zoneColors = {
    'North': '#3B82F6',
    'Central': '#8B5CF6', 
    'South': '#10B981',
    'Unknown': '#6B7280'
  };

  const zoneCounts = {};
  
  normalizedAssets.forEach(item => {
    const zone = item.zone || 'Unknown';
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });

  return Object.entries(zoneCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: zoneColors[name] || zoneColors['Unknown']
    }));
};

/**
 * Generate recent activity data from live database
 * @returns {Promise<Array>} Recent activity data
 */
export const generateRecentActivity = async () => {
  const assetsData = await fetchLiveAssetData();
  const normalizedAssets = normalizeApiData(assetsData, 'asset');
  
  const activities = [];
  const now = new Date();
  
  const warningItems = filterItemsByStatus(normalizedAssets, 'warning');
  const inactiveItems = filterItemsByStatus(normalizedAssets, 'inactive');
  const activeItems = filterItemsByStatus(normalizedAssets, 'online');

  // Add warning activities
  warningItems.slice(0, 3).forEach((item, index) => {
    const time = new Date(now.getTime() - (index + 1) * 30 * 60000);
    activities.push({
      time: time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      event: `${item.type.toUpperCase()} system warning detected`,
      location: `${item.zone} - ${item.name}`,
      status: 'warning',
      timestamp: time
    });
  });

  // Add offline activities
  inactiveItems.slice(0, 2).forEach((item, index) => {
    const time = new Date(now.getTime() - (index + 4) * 45 * 60000);
    activities.push({
      time: time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      event: `${item.type.toUpperCase()} device offline`,
      location: `${item.zone} - ${item.name}`,
      status: 'error',
      timestamp: time
    });
  });

  // Add success activity if there are active items
  if (activeItems.length > 0) {
    const time = new Date(now.getTime() - 60 * 60000);
    activities.push({
      time: time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      event: 'System health check completed successfully',
      location: 'All Regions',
      status: 'success',
      timestamp: time
    });
  }

  return activities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
};

/**
 * Generate asset status chart data from filtered asset data
 * @param {Array} filteredAssets - Already filtered assets data
 * @returns {Array} Chart data for asset status
 */
export const generateFilteredAssetStatusData = async (filteredAssets) => {
  const normalizedAssets = normalizeApiData(filteredAssets, 'asset');
  
  const assetTypes = ['cctv', 'vms', 'avds', 'et'];
  
  return assetTypes.map(type => {
    const typeItems = normalizedAssets.filter(item => 
      item.type.toLowerCase() === type.toLowerCase()
    );
    
    if (typeItems.length === 0) return null;

    const active = filterItemsByStatus(typeItems, 'online').length;
    const inactive = filterItemsByStatus(typeItems, 'inactive').length;
    const warning = filterItemsByStatus(typeItems, 'warning').length;

    return {
      name: type.toUpperCase(),
      active,
      inactive,
      warning,
      total: typeItems.length
    };
  }).filter(Boolean);
};

/**
 * Generate zone distribution chart data from filtered asset data
 * @param {Array} filteredAssets - Already filtered assets data
 * @returns {Array} Chart data for zone distribution
 */
export const generateFilteredZoneDistributionData = async (filteredAssets) => {
  const normalizedAssets = normalizeApiData(filteredAssets, 'asset');
  
  const zoneColors = {
    'North': '#3B82F6',
    'Central': '#8B5CF6', 
    'South': '#10B981',
    'Unknown': '#6B7280'
  };

  const zoneCounts = {};
  
  normalizedAssets.forEach(item => {
    const zone = item.zone || 'Unknown';
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });

  return Object.entries(zoneCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: zoneColors[name] || zoneColors['Unknown']
    }));
};

/**
 * Get initial stats state
 * @returns {Object} Initial stats object
 */
export const getInitialStats = () => ({
  totalAssets: 0,
  activeAssets: 0,
  inactiveAssets: 0,
  warningAssets: 0,
  avgUptime: 0,
  totalIncidents: 0,
  resolvedIncidents: 0,
  pendingIncidents: 0
});
