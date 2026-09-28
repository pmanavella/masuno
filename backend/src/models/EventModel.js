import { supabaseAnon, supabaseForUser } from '../config/supabaseClient.js';
import { EVENT_GENDERS, eventError } from '../services/eventService.js';

// Con token, la consulta corre como ese usuario (RLS); sin token, como anónimo.
function clientFor(accessToken) {
  return accessToken ? supabaseForUser(accessToken) : supabaseAnon;
}

export const EventModel = {
  async list(filters, accessToken) {
    let query = clientFor(accessToken).from('events').select('*').order('starts_at', { ascending: true });

    if (filters.city) query = query.eq('city', filters.city);
    if (filters.categories && filters.categories.length > 0) query = query.in('category', filters.categories);
    if (filters.date) {
      query = query.gte('starts_at', `${filters.date}T00:00:00`).lte('starts_at', `${filters.date}T23:59:59`);
    }
    // Un evento matchea el filtro de edad si su rango [age_min, age_max] se superpone con [ageMin, ageMax]
    // pedido. age_max null = sin límite superior. ageMin ya viene validado como entero.
    if (filters.ageMin != null) query = query.or(`age_max.is.null,age_max.gte.${filters.ageMin}`);
    if (filters.ageMax != null) query = query.lte('age_min', filters.ageMax);
    // Se aceptan también las etiquetas con mayúscula ("Femenino") que manda la UI actual.
    const gender = filters.gender?.toLowerCase();
    if (EVENT_GENDERS.includes(gender) && gender !== 'indistinto') {
      query = query.in('gender', [gender, 'indistinto']);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async listCities(accessToken) {
    const { data, error } = await clientFor(accessToken).from('events').select('city');
    if (error) throw error;
    return [...new Set(data.map((row) => row.city))].sort();
  },

  async getById(id, accessToken) {
    const { data, error } = await clientFor(accessToken).from('events').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async listOrganized(userId, accessToken) {
    const { data, error } = await supabaseForUser(accessToken)
      .from('events')
      .select('*')
      .eq('organizer_id', userId)
      .order('starts_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  // RLS exige usuario verificado, organizer_id propio y fecha futura.
  async create(fields, userId, accessToken) {
    const { data, error } = await supabaseForUser(accessToken)
      .from('events')
      .insert({
        ...fields,
        organizer_id: userId,
        // Los pisa el trigger de la base con el nombre verificado ("Lucía M."); van porque son NOT NULL.
        organizer_name: '-',
        organizer_initials: '-',
      })
      .select()
      .single();
    if (error) {
      if (error.code === '42501') throw eventError('not_verified');
      if (error.code === '23514') throw eventError('invalid_input');
      throw error;
    }
    return data;
  },
};
