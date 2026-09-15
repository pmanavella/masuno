import { supabaseAnon } from '../config/supabaseClient.js';

export const EventModel = {
  async list(filters) {
    let query = supabaseAnon.from('events').select('*').order('starts_at', { ascending: true });

    if (filters.city) query = query.eq('city', filters.city);
    if (filters.categories && filters.categories.length > 0) query = query.in('category', filters.categories);
    if (filters.date) {
      query = query.gte('starts_at', `${filters.date}T00:00:00`).lte('starts_at', `${filters.date}T23:59:59`);
    }
    // Un evento matchea el filtro de edad si su rango [age_min, age_max] se superpone con [ageMin, ageMax] pedido.
    if (filters.ageMin != null) query = query.gte('age_max', filters.ageMin);
    if (filters.ageMax != null) query = query.lte('age_min', filters.ageMax);
    if (filters.gender && filters.gender !== 'Indistinto') {
      query = query.in('gender', [filters.gender, 'Indistinto']);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async listCities() {
    const { data, error } = await supabaseAnon.from('events').select('city');
    if (error) throw error;
    return [...new Set(data.map((row) => row.city))].sort();
  },
};
