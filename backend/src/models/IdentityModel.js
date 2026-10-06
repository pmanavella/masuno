import { supabaseAdmin, supabaseForUser } from '../config/supabaseClient.js';
import { identityError } from '../services/identityService.js';

// Verificación de identidad contra ARCA (etapa futura). Solo se usa con ARCA_ENABLED=true.

// Errores que save_verified_identity levanta con un código estable en el mensaje.
const DB_ERROR_CODES = ['already_verified', 'dni_taken', 'underage', 'invalid_birth_date'];

export const IdentityModel = {
  // Identidad verificada por ARCA (is_verified() solo cuenta source = 'arca').
  async isVerified(accessToken) {
    const { data, error } = await supabaseForUser(accessToken).rpc('is_verified');
    if (error) throw error;
    return data === true;
  },

  // Identidad verificada propia, enmascarada (DNI/CUIL), o null si no hay.
  async getMine(accessToken) {
    const { data, error } = await supabaseForUser(accessToken).rpc('get_my_identity');
    if (error) throw error;
    return data?.[0] ?? null;
  },

  // Las funciones de acá para abajo solo las puede ejecutar service_role.

  async consumeAttempt(userId, maxAttempts, windowMinutes) {
    const { data, error } = await supabaseAdmin.rpc('consume_identity_attempt', {
      p_user_id: userId,
      p_max: maxAttempts,
      p_window_minutes: windowMinutes,
    });
    if (error) throw error;
    return data === true;
  },

  // Libre en datos declarados e identidades verificadas, sin contar los del propio usuario.
  async isDniAvailable(dni, userId) {
    const { data, error } = await supabaseAdmin.rpc('identity_dni_available', {
      p_dni: dni,
      p_exclude_user_id: userId,
    });
    if (error) throw error;
    return data === true;
  },

  async save({ userId, dni, cuil, firstName, lastName, birthDate, gender, source }) {
    const { error } = await supabaseAdmin.rpc('save_verified_identity', {
      p_user_id: userId,
      p_dni: dni,
      p_cuil: cuil,
      p_first_name: firstName,
      p_last_name: lastName,
      p_birth_date: birthDate,
      p_gender: gender,
      p_source: source,
    });
    if (error) {
      if (DB_ERROR_CODES.includes(error.message)) throw identityError(error.message);
      throw error;
    }
  },

  // Ticket de WSAA compartido entre reinicios del backend (ver RealArcaClient).
  arcaTicketStore: {
    async get(service) {
      const { data, error } = await supabaseAdmin.rpc('get_arca_ticket', { p_service: service });
      if (error) throw error;
      const row = data?.[0];
      return row ? { token: row.token, sign: row.sign, expiresAt: row.expires_at } : null;
    },

    async save(service, { token, sign, expiresAt }) {
      const { error } = await supabaseAdmin.rpc('save_arca_ticket', {
        p_service: service,
        p_token: token,
        p_sign: sign,
        p_expires_at: expiresAt,
      });
      if (error) throw error;
    },
  },
};
