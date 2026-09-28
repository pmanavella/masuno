import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { authErrorMessage } from '../lib/authErrors.js';

// Oculto hasta que se habilite Google en Supabase: VITE_ENABLE_GOOGLE_AUTH=true.
export const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';

export function GoogleSignInButton() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');

  if (!GOOGLE_AUTH_ENABLED) return null;

  async function handleClick() {
    setError('');
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) setError(authErrorMessage(oauthError));
  }

  return (
    <>
      <div className="auth-divider"><span>o</span></div>
      <button className="btn-secondary btn-block" type="button" onClick={handleClick}>
        Continuar con Google
      </button>
      {error && <p className="error-text">{error}</p>}
    </>
  );
}
