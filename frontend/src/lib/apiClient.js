import { supabase } from './supabaseClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // code: código estable del backend (p. ej. 'underage', 'dni_taken'), si lo hay.
    throw Object.assign(new Error(body?.error || 'Error de red'), { code: body?.code, status: res.status });
  }
  return body;
}

export const api = {
  getProfile: () => request('/profile'),
  updatePhone: (phone) => request('/profile', { method: 'PUT', body: JSON.stringify({ phone }) }),
  getIdentity: () => request('/identity'),
  verifyIdentity: (fields) => request('/identity/verify', { method: 'POST', body: JSON.stringify(fields) }),
  getEvents: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length > 0) params.set(key, value.join(','));
      } else if (value !== undefined && value !== null && value !== '') {
        params.set(key, value);
      }
    });
    return request(`/events?${params.toString()}`);
  },
  getCities: () => request('/events/cities'),
  getEvent: (id) => request(`/events/${id}`),
  createEvent: (fields) => request('/events', { method: 'POST', body: JSON.stringify(fields) }),
  getOrganizedEvents: () => request('/events/organized'),
  requestToJoin: (eventId) => request(`/events/${eventId}/requests`, { method: 'POST' }),
  getMyRequests: () => request('/requests/mine'),
  respondToRequest: (requestId, accept) =>
    request(`/requests/${requestId}/respond`, { method: 'POST', body: JSON.stringify({ accept }) }),
  cancelRequest: (requestId) => request(`/requests/${requestId}/cancel`, { method: 'POST' }),
  getNotifications: () => request('/notifications'),
  markNotificationsRead: () => request('/notifications/read', { method: 'POST' }),
};
