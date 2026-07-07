// Helper function to determine Malaysian zone based on coordinates
export const getMalaysianZone = (lat, lng) => {
  // Parse coordinates if they're strings
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  // Check for valid coordinates
  if (isNaN(latitude) || isNaN(longitude)) {
    return "Unknown";
  }

  // North Zone: Perlis, Kedah, Penang, Perak
  if (
    latitude >= 4.0 &&
    latitude <= 6.7 &&
    longitude >= 100.0 &&
    longitude <= 101.5
  ) {
    return "North";
  }

  // Central Zone: Kuala Lumpur, Selangor
  if (
    latitude >= 2.7 &&
    latitude <= 3.8 &&
    longitude >= 101.0 &&
    longitude <= 102.0
  ) {
    return "Central";
  }

  // South Zone: Negeri Sembilan, Melaka, Johor
  if (
    latitude >= 1.2 &&
    latitude <= 3.0 &&
    longitude >= 101.5 &&
    longitude <= 104.0
  ) {
    return "South";
  }

  // If in general Malaysia region but not matched specifically, assign based on latitude
  if (
    latitude >= 1.0 &&
    latitude <= 6.8 &&
    longitude >= 99.5 &&
    longitude <= 104.5
  ) {
    if (latitude >= 4.0) return "North";
    if (latitude >= 2.7) return "Central";
    return "South";
  }

  return "Unknown";
};

// Mapping functions for backend ID to frontend string conversion
export const mapAssetTypeId = (typeId) => {
  return "avds";
};

export const mapAssetStatusId = (statusId) => {
  // Handle both string and number inputs
  const id = String(statusId).toLowerCase();

  const statusMap = {
    1: "online",
    active: "online",
    online: "online",
    2: "offline",
    inactive: "offline",
    offline: "offline",
    3: "warning",
    warning: "warning",
  };

  return statusMap[id] || "offline";
};

export const mapZoneId = (zoneId) => {
  // Handle both string and number inputs
  const id = String(zoneId).toLowerCase();

  const zoneMap = {
    1: "North",
    north: "North",
    2: "Central",
    central: "Central",
    3: "South",
    south: "South",
  };

  return zoneMap[id] || "Unknown";
};

// Reverse mapping functions for frontend to backend conversion
export const mapTypeToId = (type) => {
  return "3";
};

export const mapStatusToId = (status) => {
  const statusMap = {
    active: "1",
    online: "1",
    inactive: "2",
    offline: "2",
    warning: "3",
  };
  return statusMap[status] || "2";
};

export const mapZoneToId = (zone) => {
  const zoneMap = {
    North: "1",
    Central: "2",
    South: "3",
  };
  return zoneMap[zone] || "1";
};

// Helper function to filter locations
export const filterLocations = (locations, status, type, zone, searchTerm) => {
  // Validate input to prevent errors
  if (!Array.isArray(locations)) {
    console.warn("filterLocations received invalid locations:", locations);
    return [];
  }

  return locations.filter((loc) => {
    // Skip any invalid location objects
    if (!loc || typeof loc !== "object") {
      return false;
    }

    // Check status match
    const statusMatch = status === "all" || loc.status === status;

    // Check type match
    const typeMatch = type === "all" || loc.type === type;

    // Check zone match with hierarchical support
    let zoneMatch = false;
    if (zone === "all") {
      zoneMatch = true;
    } else if (zone === "North" || zone === "Central" || zone === "South") {
      // Parent zone selected - match all subzones with the same prefix
      const zonePrefix = zone.charAt(0); // N, C, or S
      zoneMatch = loc.zone && (
        loc.zone === zone || // Exact match (legacy)
        (loc.zone.startsWith(zonePrefix) && loc.zone.length <= 3) // N1, N2, C1, C2, S1, S2, etc.
      );
    } else {
      // Specific subzone selected - exact match
      zoneMatch = loc.zone === zone;
    }

    // Check search match - name, IP, address, description
    const term = searchTerm && searchTerm.trim() ? searchTerm.trim().toLowerCase() : "";
    const searchMatch =
      !term ||
      [loc.name, loc.ip, loc.address, loc.description]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(term));

    return statusMatch && typeMatch && zoneMatch && searchMatch;
  });
};

// Initial form state for resetting forms
export const initialFormState = {
  name: "",
  lat: "",
  lng: "",
  description: "",
  address: "",
  status: "online",
  type: "avds",
  zone: "",
};
