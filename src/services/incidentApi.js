import { fetchWithAuth } from './http';
import config from '../config';

const BASE = () => `${config.API_URL}/api/incidents`;

export async function getIncidents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchWithAuth(`${BASE()}${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.status}`);
  return res.json();
}

export async function getActiveIncidents() {
  const res = await fetch(`${config.API_URL}/api/incidents/active`);
  if (!res.ok) throw new Error(`Failed to fetch active incidents: ${res.status}`);
  return res.json();
}

export async function getIncident(id) {
  const res = await fetchWithAuth(`${BASE()}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch incident: ${res.status}`);
  return res.json();
}

export async function createIncident(data) {
  const res = await fetchWithAuth(BASE(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create incident: ${res.status}`);
  }
  return res.json();
}

export async function updateIncident(id, data) {
  const res = await fetchWithAuth(`${BASE()}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update incident: ${res.status}`);
  }
  return res.json();
}

export async function deleteIncident(id) {
  const res = await fetchWithAuth(`${BASE()}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete incident: ${res.status}`);
  return res.json();
}
