import config from '../config';
import { axiosGet, axiosPost, axiosPut, axiosPatch, axiosDelete } from './http';

const BASE = `${config.API_URL}/api/vms-message-lists`;
const SEND_BASE = `${config.API_URL}/api/vms-message-send`;

export const vmsMessageListApi = {
  /** Get all lists, optionally filtered by VMS device (location_id) */
  getAll: (locationId = null) => {
    const url = locationId != null ? `${BASE}?location_id=${locationId}` : BASE;
    return axiosGet(url).then((r) => r.data);
  },
  getOne: (id) => axiosGet(`${BASE}/${id}`).then((r) => r.data),
  getHistory: (id) => axiosGet(`${BASE}/${id}/history`).then((r) => r.data),
  create: (payload) => axiosPost(BASE, payload).then((r) => r.data),
  update: (id, payload) => axiosPut(`${BASE}/${id}`, payload).then((r) => r.data),
  delete: (id) => axiosDelete(`${BASE}/${id}`).then((r) => r.data),
  activate: (id) => axiosPatch(`${BASE}/${id}/activate`, {}).then((r) => r.data),
  requestApproval: (id) => axiosPatch(`${BASE}/${id}/request`, {}).then((r) => r.data),
  /** Record message send with full raw QST content to vms_message_send_history */
  sendHistory: (payload) => axiosPost(SEND_BASE, payload).then((r) => r.data),
};
