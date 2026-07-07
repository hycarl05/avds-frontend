import config from '../config';
import { axiosGet } from './http';

const BASE = `${config.API_URL}/api/locations`;

export const vmsNearestCctvApi = {
  /** Returns ranked nearest CCTVs for a VMS location id */
  getNearest: (vmsId) => axiosGet(`${BASE}/${vmsId}/nearest-cctv`).then((r) => r.data),
};
