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
    throw new Error(body?.error || 'Error de red');
  }
  return body;
}

export const api = {
  getProfile: () => request('/profile'),
  updateProfile: (fields) => request('/profile', { method: 'PUT', body: JSON.stringify(fields) }),
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
};
