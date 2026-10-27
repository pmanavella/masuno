import { createClient } from '@supabase/supabase-js';
import { DEMO_MODE, DEMO_UNAVAILABLE_MESSAGE } from './demoMode.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// En la demo no se crea el cliente: no restaura sesiones guardadas ni abre conexiones. Cualquier
// uso que se haya escapado falla con un mensaje claro en vez de tocar la base real.
const demoGuard = new Proxy({}, {
  get() {
    throw new Error(DEMO_UNAVAILABLE_MESSAGE);
  },
});

export const supabase = DEMO_MODE ? demoGuard : createClient(supabaseUrl, supabaseAnonKey);
