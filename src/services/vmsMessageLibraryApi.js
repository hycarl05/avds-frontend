import config from '../config';
import { axiosGet, axiosPost, axiosPut, axiosDelete } from './http';

const BASE = `${config.API_URL}/api/vms-message-templates`;

export const vmsMessageLibraryApi = {
  /** Get all templates. Optional filters: { category, search } */
  getAll: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.search)   qs.set('search', params.search);
    const url = qs.toString() ? `${BASE}?${qs}` : BASE;
    return axiosGet(url).then((r) => r.data);
  },

  /** Get all distinct category names */
  getCategories: () => axiosGet(`${BASE}/categories`).then((r) => r.data),

  getOne: (id) => axiosGet(`${BASE}/${id}`).then((r) => r.data),

  /** Create a template. Payload: { title, category?, description?, content } */
  create: (payload) => axiosPost(BASE, payload).then((r) => r.data),

  /** Update a template. Payload: { title?, category?, description?, content? } */
  update: (id, payload) => axiosPut(`${BASE}/${id}`, payload).then((r) => r.data),

  delete: (id) => axiosDelete(`${BASE}/${id}`).then((r) => r.data),
};
