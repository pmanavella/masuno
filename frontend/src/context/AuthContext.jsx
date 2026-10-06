import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

// Después de confirmar el email o entrar con Google se vuelve al inicio.
const AFTER_AUTH_URL = () => `${window.location.origin}/`;

// El registro va por el backend (api.register). Acá solo sesión, login y logout.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  const value = {
    session,
    user,
    loading,
    // Solo para la UI: el backend y la base lo vuelven a comprobar en cada acción protegida.
    emailConfirmed: Boolean(user?.email_confirmed_at),
    signIn: (email, password, captchaToken) =>
      supabase.auth.signInWithPassword({ email, password, options: { captchaToken } }),
    signInWithGoogle: () =>
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: AFTER_AUTH_URL() },
      }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
