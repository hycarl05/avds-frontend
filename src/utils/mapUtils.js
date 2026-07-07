import { Icon } from 'leaflet';

// Import CCTV icons
import activeIconImage from '../img/cctv-icon-active.png';
import inactiveIconImage from '../img/cctv-icon-inactive.png';
import warningIconImage from '../img/cctv-icon-warning.png';

// Import VMS icons
import vmsActiveIconImage from '../img/vms-icon-active.png';
import vmsInactiveIconImage from "../img/vms-icon-inactive.png";
import vmsWarningIconImage from '../img/vms-icon-warning.png';

// Import AVDS icons
import avdsActiveIconImage from '../img/avds-icon-active.png';
import avdsInactiveIconImage from '../img/avds-icon-inactive.png';
import avdsWarningIconImage from '../img/avds-icon-warning.png';

// Import ET icons
import etActiveIconImage from '../img/et-icon-active.png';
import etInactiveIconImage from '../img/et-icon-inactive.png';
import etWarningIconImage from '../img/et-icon-warning.png';

// CCTV Marker Icons
const cctvActiveIcon = new Icon({
  iconUrl: activeIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

const cctvInactiveIcon = new Icon({
  iconUrl: inactiveIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

const cctvWarningIcon = new Icon({
  iconUrl: warningIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

// VMS Marker Icons
const vmsActiveIcon = new Icon({
  iconUrl: vmsActiveIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

const vmsInactiveIcon = new Icon({
  iconUrl: vmsInactiveIconImage,
  iconSize: [64, 64],
  iconAnchor: [16, 32],
});

const vmsWarningIcon = new Icon({
  iconUrl: vmsWarningIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

// AVDS Marker Icons
const avdsActiveIcon = new Icon({
  iconUrl: avdsActiveIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

const avdsInactiveIcon = new Icon({
  iconUrl: avdsInactiveIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

const avdsWarningIcon = new Icon({
  iconUrl: avdsWarningIconImage,
  iconSize: [50, 50],
  iconAnchor: [16, 32],
});

// ET Marker Icons
const etActiveIcon = new Icon ({
    iconUrl: etActiveIconImage,
    iconSize: [50, 50],
    iconAnchor: [16, 32],
});

const etInactiveIcon = new Icon ({
    iconUrl: etInactiveIconImage,
    iconSize: [50, 50],
    iconAnchor: [16, 32],
});

const etWarningIcon = new Icon ({
    iconUrl: etWarningIconImage,
    iconSize: [50, 50],
    iconAnchor: [16, 32],
});

export const getIcon = (type, status) => {
    switch (type) {
        case 'vms' :
            return status === 'online'
            ? vmsActiveIcon
            : status === 'warning'
            ? vmsWarningIcon
            : vmsInactiveIcon;
        case 'avds':
            return status === 'online'
            ? avdsActiveIcon 
            : status === 'warning'
            ? avdsWarningIcon
            : avdsInactiveIcon;
        case 'et':
            return status === 'online'
            ? etActiveIcon
            : status === 'warning'
            ? etWarningIcon
            : etInactiveIcon;
        default: //Default to CCTV
            return status === 'online'
            ? cctvActiveIcon
            : status === 'warning'
            ? cctvWarningIcon
            : cctvInactiveIcon;
    }
};

export const mapAssetStatusId = (statusId) => {
    const id = String(statusId).toLowerCase();
    const statusMap = {
        '1':'online',
        'online':'online',
        '2':'offline',
        'offline':'offline',
        '3':'warning',
        'warning': 'warning',
    };
    return statusMap[id] || 'offline'; //Default to offline
};

export const getMalaysianZone = (lat, lng) => {
    //Parse coordinates if they're strings
    const latitude = parseFloat(lat);
    const longitude = parseFloat (lng);

    //Check for valid coordinates
    if(isNaN(latitude) || isNaN(longitude)) {
        return 'Unknown';
    }

    //North Zone: Perlis, Kedah, Penang, Perak
    if (
        latitude>=4.0 &&
        latitude<=6.7 &&
        longitude>= 101.0 &&
        longitude <= 102.0
    ) {
        return 'Central';
    }

    //South Zone: Negeri Sembilan, Melaka, Johor
    if (
        latitude>= 1.2 &&
        latitude <= 3.0 && 
        longitude >= 101.5 && 
        longitude <= 104.0
    ) {
        return 'South';
    }

    // If in general Malaysia region but not matched specifically, assign based on latitude
    if (
        latitude >= 1.0 &&
        latitude <= 6.8 &&
        longitude >= 99.5 &&
        longitude <= 104.5
    ) {
        if (latitude >= 4.0) return 'North';
        if (latitude >= 2.7) return 'Central';
        return 'South';
    }
    return 'Unknown';
};

export const filterLocations = (locations, status, type, zone, searchTerm) => {
    if (!Array.isArray(locations)) {
        console.warn('filterLocations received invalid locations:', locations);
        return [];
    }

    return locations.filter((loc) => {
        if (!loc || typeof loc !== 'object') {
            return false;
        }

        const statusMatch = status === 'all' || loc.status === status;
        const typeMatch = type === 'all' || loc.type === type;
        let zoneMatch;
        if (zone === 'all') {
            zoneMatch = true;
        } else {
            const parentZones = ['North', 'Central', 'South'];
            const zoneValue = typeof loc.zone === 'string' ? loc.zone : String(loc.zone ?? '');
            if (parentZones.includes(zone)) {
                // Parent zone: match exact OR any subzone with the same prefix (N*, C*, S*)
                const prefix = zone.charAt(0);
                zoneMatch = zoneValue === zone || (zoneValue.startsWith(prefix) && zoneValue.length <= 3);
            } else {
                // Subzone: exact match
                zoneMatch = zoneValue === zone;
            }
        }
        const searchMatch = 
            !searchTerm || 
            !searchTerm.trim() ||
            (loc.name && loc.name.toLowerCase().includes(searchTerm.toLowerCase()));

            return statusMatch && typeMatch && zoneMatch && searchMatch;
    });
};

// Zone  coordinates for map panning
export const zoneCoordinates = {
    North : { center: [5.5, 100.8], zoom:8},
    Central : { center: [3.2, 101.5], zoom: 9},
    South: { center: [1.8, 103.2], zoom:8 },
    Unknown: { center: [4.2105, 101.9758], zoom:7 },
};

export const getStatusColor = (status) => {
    switch (status) {
        case 'online':
            return 'green';
        case 'warning':
            return 'orange';
        default:
            return 'red';
    }
};




