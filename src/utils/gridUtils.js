/**
 * Grid utilities
 * Functions for handling grid layout and camera selection
 */

import { GRID_SIZE_CONFIG, getGridDimensions, getGridCssClass } from '../constants/assetConstants';

/**
 * Validate grid size
 * @param {number} size - Grid size to validate
 * @returns {boolean} Whether the grid size is valid
 */
export const isValidGridSize = (size) => {
  return GRID_SIZE_CONFIG.some(config => config.value === size);
};

/**
 * Get next available grid size
 * @param {number} currentSize - Current grid size
 * @param {string} direction - Direction to move (next, prev)
 * @returns {number} Next grid size
 */
export const getNextGridSize = (currentSize, direction = 'next') => {
  const currentIndex = GRID_SIZE_CONFIG.findIndex(config => config.value === currentSize);
  
  if (currentIndex === -1) return GRID_SIZE_CONFIG[0].value;
  
  if (direction === 'next') {
    const nextIndex = (currentIndex + 1) % GRID_SIZE_CONFIG.length;
    return GRID_SIZE_CONFIG[nextIndex].value;
  } else {
    const prevIndex = currentIndex === 0 ? GRID_SIZE_CONFIG.length - 1 : currentIndex - 1;
    return GRID_SIZE_CONFIG[prevIndex].value;
  }
};

/**
 * Create empty grid slots
 * @param {number} size - Grid size
 * @returns {Array} Array with null values for empty slots
 */
export const createEmptyGrid = (size) => {
  return Array(size).fill(null);
};

/**
 * Fill grid with cameras
 * @param {Array} cameras - Array of available cameras
 * @param {number} gridSize - Grid size
 * @param {Array} selectedCameras - Currently selected cameras
 * @returns {Array} Grid with cameras
 */
export const fillGridWithCameras = (cameras, gridSize, selectedCameras = null) => {
  if (selectedCameras && selectedCameras.some(camera => camera !== null)) {
    // Use selected cameras
    const result = [];
    for (let i = 0; i < gridSize; i++) {
      result.push(selectedCameras[i] || null);
    }
    return result;
  } else {
    // Auto-fill with available cameras
    const result = [];
    for (let i = 0; i < gridSize; i++) {
      result.push(cameras[i] || null);
    }
    return result;
  }
};

/**
 * Get paginated cameras for grid
 * @param {Array} cameras - Array of all cameras
 * @param {number} gridSize - Grid size
 * @param {number} currentPage - Current page (1-based)
 * @returns {Object} Paginated result
 */
export const getPaginatedCameras = (cameras, gridSize, currentPage = 1) => {
  const totalPages = Math.ceil(cameras.length / gridSize);
  const startIndex = (currentPage - 1) * gridSize;
  const endIndex = startIndex + gridSize;
  const pageItems = cameras.slice(startIndex, endIndex);
  
  return {
    items: pageItems,
    currentPage,
    totalPages,
    totalItems: cameras.length,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    startIndex,
    endIndex: Math.min(endIndex, cameras.length),
  };
};

/**
 * Find optimal camera placement
 * @param {Array} availableCameras - Available cameras
 * @param {Array} currentSelection - Current camera selection
 * @param {number} gridSize - Grid size
 * @returns {Array} Optimized camera placement
 */
export const optimizeCameraPlacement = (availableCameras, currentSelection, gridSize) => {
  const result = [...currentSelection];
  
  // Fill empty slots with available cameras
  for (let i = 0; i < gridSize; i++) {
    if (!result[i]) {
      // Find first available camera not already selected
      const availableCamera = availableCameras.find(camera => 
        !result.some(selected => selected?.id === camera.id)
      );
      
      if (availableCamera) {
        result[i] = availableCamera;
      }
    }
  }
  
  return result;
};

/**
 * Validate camera selection
 * @param {Array} selectedCameras - Selected cameras array
 * @param {number} gridSize - Expected grid size
 * @returns {Object} Validation result
 */
export const validateCameraSelection = (selectedCameras, gridSize) => {
  const errors = [];
  
  if (!Array.isArray(selectedCameras)) {
    errors.push('Selected cameras must be an array');
    return { isValid: false, errors };
  }
  
  if (selectedCameras.length !== gridSize) {
    errors.push(`Selection array length (${selectedCameras.length}) must match grid size (${gridSize})`);
  }
  
  // Check for duplicate cameras
  const validCameras = selectedCameras.filter(camera => camera !== null);
  const uniqueCameras = new Set(validCameras.map(camera => camera.id));
  
  if (validCameras.length !== uniqueCameras.size) {
    errors.push('Duplicate cameras detected in selection');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    stats: {
      totalSlots: selectedCameras.length,
      filledSlots: validCameras.length,
      emptySlots: selectedCameras.length - validCameras.length,
    },
  };
};

/**
 * Convert flat index to grid coordinates
 * @param {number} index - Flat array index
 * @param {number} gridSize - Grid size
 * @returns {Object} Grid coordinates {row, col}
 */
export const indexToGridCoordinates = (index, gridSize) => {
  const { cols } = getGridDimensions(gridSize);
  return {
    row: Math.floor(index / cols),
    col: index % cols,
  };
};

/**
 * Convert grid coordinates to flat index
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} gridSize - Grid size
 * @returns {number} Flat array index
 */
export const gridCoordinatesToIndex = (row, col, gridSize) => {
  const { cols } = getGridDimensions(gridSize);
  return row * cols + col;
};

/**
 * Get adjacent grid positions
 * @param {number} index - Current position index
 * @param {number} gridSize - Grid size
 * @returns {Array} Array of adjacent indices
 */
export const getAdjacentPositions = (index, gridSize) => {
  const { rows, cols } = getGridDimensions(gridSize);
  const { row, col } = indexToGridCoordinates(index, gridSize);
  const adjacent = [];
  
  // Check all four directions
  const directions = [
    [-1, 0], // Up
    [1, 0],  // Down
    [0, -1], // Left
    [0, 1],  // Right
  ];
  
  directions.forEach(([deltaRow, deltaCol]) => {
    const newRow = row + deltaRow;
    const newCol = col + deltaCol;
    
    if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
      adjacent.push(gridCoordinatesToIndex(newRow, newCol, gridSize));
    }
  });
  
  return adjacent;
};

/**
 * Calculate grid layout statistics
 * @param {Array} selectedCameras - Selected cameras
 * @param {number} gridSize - Grid size
 * @returns {Object} Layout statistics
 */
export const calculateGridStats = (selectedCameras, gridSize) => {
  const validation = validateCameraSelection(selectedCameras, gridSize);
  const { rows, cols } = getGridDimensions(gridSize);
  
  return {
    ...validation.stats,
    dimensions: { rows, cols },
    fillPercentage: Math.round((validation.stats.filledSlots / validation.stats.totalSlots) * 100),
    cssClass: getGridCssClass(gridSize),
    isComplete: validation.stats.filledSlots === validation.stats.totalSlots,
    isEmpty: validation.stats.filledSlots === 0,
  };
};
