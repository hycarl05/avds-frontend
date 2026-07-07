/**
 * Asset data transformation utilities
 * Functions for formatting and transforming asset data
 */

/**
 * Format raw asset data from API response
 * @param {Object} rawAsset - Raw asset data from API
 * @returns {Object} Formatted asset object
 */
export const formatAssetData = (rawAsset) => {
  return {
    id: rawAsset.id.toString(),
    name: rawAsset.name,
    location: rawAsset.zone_id || "Unknown",
    status: rawAsset.asset_status_id || "inactive",
    lat: parseFloat(rawAsset.lat),
    lng: parseFloat(rawAsset.lng),
    type: (rawAsset.asset_type_id || "cctv").toLowerCase(),
    zone: rawAsset.zone_id || "Unknown",
    videoPath: rawAsset.videoPath || null,
    description: rawAsset.description || rawAsset.popUp || "",
    ipAddress: rawAsset.asset_address || null,
    assetAddress: rawAsset.asset_address || null,
    createdAt: rawAsset.created_at,
    updatedAt: rawAsset.updated_at,
  };
};

/**
 * Group assets by type
 * @param {Array} assets - Array of formatted assets
 * @returns {Object} Assets grouped by type
 */
export const groupAssetsByType = (assets) => {
  const grouped = { cctv: [], vms: [], avds: [], et: [] };
  
  assets.forEach((asset) => {
    const assetType = asset.type.toLowerCase();
    if (grouped[assetType]) {
      grouped[assetType].push(asset);
    } else {
      grouped.cctv.push(asset); // Default fallback
    }
  });
  
  return grouped;
};

/**
 * Extract unique zones from assets
 * @param {Array} assets - Array of assets
 * @returns {Array} Array of unique zone names
 */
export const extractUniqueZones = (assets) => {
  const zones = new Set(["All Zones"]);
  
  assets.forEach((asset) => {
    if (asset.zone_id) {
      zones.add(asset.zone_id);
    }
  });
  
  return Array.from(zones);
};

/**
 * Filter assets by criteria
 * @param {Array} assets - Array of assets to filter
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered assets
 */
export const filterAssets = (assets, filters) => {
  const { zone, searchTerm, status, type } = filters;
  
  return assets.filter((asset) => {
    // Zone filter
    if (zone && zone !== "All Zones" && asset.zone !== zone) {
      return false;
    }
    
    // Search term filter
    if (searchTerm && !asset.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (status && asset.status !== status) {
      return false;
    }
    
    // Type filter
    if (type && asset.type !== type) {
      return false;
    }
    
    return true;
  });
};

/**
 * Calculate asset statistics
 * @param {Array} assets - Array of assets
 * @returns {Object} Asset statistics
 */
export const calculateAssetStats = (assets) => {
  const stats = {
    total: assets.length,
    active: 0,
    inactive: 0,
    warning: 0,
    byType: { cctv: 0, vms: 0, avds: 0, et: 0 },
  };
  
  assets.forEach((asset) => {
    // Status counts
    const status = asset.status?.toLowerCase() || "inactive";
    if (stats[status] !== undefined) {
      stats[status]++;
    }
    
    // Type counts
    const type = asset.type?.toLowerCase();
    if (stats.byType[type] !== undefined) {
      stats.byType[type]++;
    }
  });
  
  return stats;
};

/**
 * Sort assets by criteria
 * @param {Array} assets - Array of assets to sort
 * @param {string} sortBy - Sort criteria (name, status, type, zone)
 * @param {string} sortOrder - Sort order (asc, desc)
 * @returns {Array} Sorted assets
 */
export const sortAssets = (assets, sortBy = 'name', sortOrder = 'asc') => {
  return [...assets].sort((a, b) => {
    let valueA = a[sortBy];
    let valueB = b[sortBy];
    
    // Handle string comparisons
    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    if (sortOrder === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });
};

/**
 * Find asset by ID
 * @param {Array} assets - Array of assets
 * @param {string} assetId - Asset ID to find
 * @returns {Object|null} Found asset or null
 */
export const findAssetById = (assets, assetId) => {
  return assets.find(asset => asset.id === assetId) || null;
};

/**
 * Validate asset data
 * @param {Object} asset - Asset to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateAsset = (asset) => {
  const errors = [];
  
  if (!asset.name || asset.name.trim() === '') {
    errors.push('Asset name is required');
  }
  
  if (!asset.type) {
    errors.push('Asset type is required');
  }
  
  if (!asset.ipAddress && asset.type !== 'et') {
    errors.push('IP address is required for this asset type');
  }
  
  if (asset.lat && (isNaN(asset.lat) || asset.lat < -90 || asset.lat > 90)) {
    errors.push('Invalid latitude value');
  }
  
  if (asset.lng && (isNaN(asset.lng) || asset.lng < -180 || asset.lng > 180)) {
    errors.push('Invalid longitude value');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};
