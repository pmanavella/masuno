import { supabaseForUser } from '../config/supabaseClient.js';

export const ProfileModel = {
  async getById(accessToken, userId) {
    const supabase = supabaseForUser(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async update(accessToken, userId, fields) {
    const supabase = supabaseForUser(accessToken);
    // TODO(verificación futura): dni y phone se guardan tal cual los tipea el usuario, sin validar.
    // Implementar verificación real de teléfono por SMS (ej. Twilio) y de DNI antes de producción.
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: fields.fullName,
        phone: fields.phone,
        dni: fields.dni,
        birth_date: fields.birthDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
