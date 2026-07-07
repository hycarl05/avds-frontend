export const API_BASE_URL = typeof process !== 'undefined' && process.env 
  ? process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000'
  : 'http://127.0.0.1:8000';
  
export const LOCATION_TYPES = [
  { value: 'cctv', label: 'MAINLINE CCTV' },
  { value: 'rsa', label: 'RSA CCTV'},
  { value: 'vms', label: 'VMS' },
  { value: 'avds', label: 'AVDS' },
  { value: 'et', label: 'ET' },
  { value: 'layby', label: 'layby'},
];

export const LOCATION_STATUSES = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'warning', label: 'Warning' }
];

export const ZONES = [
  { id: 'North', label: 'North', color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'Central', label: 'Central', color: 'bg-purple-500 hover:bg-purple-600' },
  { id: 'South', label: 'South', color: 'bg-green-500 hover:bg-green-600' },
  { id: 'all', label: 'All Regions', color: 'bg-gray-600 hover:bg-gray-700' }
];
