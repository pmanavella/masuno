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

  // Datos declarados al registrarse (DNI enmascarado), o null si la cuenta no los tiene.
  // No están verificados contra ARCA.
  async getDeclaredIdentity(accessToken) {
    const { data, error } = await supabaseForUser(accessToken).rpc('get_my_declared_identity');
    if (error) throw error;
    return data?.[0] ?? null;
  },

  // La base solo permite al usuario actualizar phone y updated_at (permisos por columna).
  async update(accessToken, userId, fields) {
    const supabase = supabaseForUser(accessToken);
    // TODO(verificación futura): el teléfono se guarda tal cual lo tipea el usuario, sin validar.
    // Implementar verificación real por SMS (ej. Twilio) antes de producción.
    const { data, error } = await supabase
      .from('profiles')
      .update({
        phone: fields.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
