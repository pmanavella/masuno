import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan variables de Supabase en backend/.env');
}

// Bypasea RLS. Solo para las funciones reservadas a service_role (verificación de identidad,
// límite de intentos, ticket de ARCA). La service role key nunca sale del backend.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cliente sin sesión, usado solo para validar tokens de usuario (auth.getUser).
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente scoped al usuario autenticado: las consultas respetan RLS como ese usuario.
export function supabaseForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
