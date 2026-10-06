import { supabaseAdmin, supabaseAuthClient } from '../config/supabaseClient.js';

export const AccountModel = {
  // Alta en Supabase Auth: Supabase guarda la contraseña (nunca pasa por nuestras tablas), valida
  // el CAPTCHA y envía el email de confirmación. declared va como user_metadata y el trigger
  // handle_new_user lo mueve a private.declared_identities.
  async signUp({ email, password, captchaToken, redirectTo, declared }) {
    const { error } = await supabaseAuthClient().auth.signUp({
      email,
      password,
      options: { captchaToken, emailRedirectTo: redirectTo, data: declared },
    });
    return { error };
  },

  // Solo service_role. DNI libre tanto en datos declarados como en identidades verificadas.
  async isDniAvailable(dni) {
    const { data, error } = await supabaseAdmin.rpc('identity_dni_available', { p_dni: dni });
    if (error) throw error;
    return data === true;
  },
};
