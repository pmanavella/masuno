import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { api } from '../lib/apiClient.js';

const AuthContext = createContext(null);

// Después de confirmar el email o entrar con Google, la cuenta nueva va directo a verificarse.
const AFTER_AUTH_URL = () => `${window.location.origin}/verificacion`;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // identityStatus: 'none' (sin sesión) | 'loading' | 'verified' | 'unverified' | 'error'
  const [identityStatus, setIdentityStatus] = useState('none');
  const [identity, setIdentity] = useState(null);
  const requestIdRef = useRef(0);

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

  const userId = session?.user?.id ?? null;

  const refreshIdentity = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!userId) {
      setIdentity(null);
      setIdentityStatus('none');
      return;
    }
    setIdentityStatus('loading');
    try {
      const data = await api.getIdentity();
      // Si mientras tanto cambió la sesión, esta respuesta ya no corresponde.
      if (requestId !== requestIdRef.current) return;
      setIdentity(data.identity);
      setIdentityStatus(data.verified ? 'verified' : 'unverified');
    } catch {
      if (requestId !== requestIdRef.current) return;
      setIdentity(null);
      setIdentityStatus('error');
    }
  }, [userId]);

  // Solo cuando cambia el usuario (no en cada refresh del token).
  useEffect(() => {
    refreshIdentity();
  }, [refreshIdentity]);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    identity,
    identityStatus,
    refreshIdentity,
    signUp: (email, password, captchaToken) =>
      supabase.auth.signUp({
        email,
        password,
        options: { captchaToken, emailRedirectTo: AFTER_AUTH_URL() },
      }),
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
