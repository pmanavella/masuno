import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { TurnstileWidget } from '../components/TurnstileWidget.jsx';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';
import { authErrorMessage } from '../lib/authErrors.js';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const turnstileRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!captchaToken) {
      setError('Completá la verificación de seguridad.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await signIn(email, password, captchaToken);
    setLoading(false);
    turnstileRef.current?.reset();
    if (signInError) {
      setError(authErrorMessage(signInError));
      return;
    }
    navigate('/');
  }

  return (
    <div className="auth-card">
      <h1>Ingresar</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <GoogleSignInButton />
      <p className="muted">¿No tenés cuenta? <Link to="/registro">Creá una</Link></p>
    </div>
  );
}
