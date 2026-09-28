import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { TurnstileWidget } from '../components/TurnstileWidget.jsx';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';
import { checkPasswordRules, passwordMeetsRules, pwnedCount } from '../lib/passwordPolicy.js';
import { authErrorMessage } from '../lib/authErrors.js';

// Solo crea la cuenta. Los datos de identidad (DNI, nombre, fecha de nacimiento, género)
// se cargan después en /verificacion y se validan contra ARCA desde el backend.
export function RegisterPage() {
  const { signUp } = useAuth();
  const turnstileRef = useRef(null);
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const rules = checkPasswordRules(form.password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!passwordMeetsRules(form.password)) {
      setError('La contraseña no cumple todos los requisitos.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!captchaToken) {
      setError('Completá la verificación de seguridad.');
      return;
    }

    setLoading(true);
    try {
      const leaks = await pwnedCount(form.password);
      if (leaks > 0) {
        setError('No creamos tu cuenta: esta contraseña apareció en filtraciones de datos. Elegí otra.');
        return;
      }

      const { error: signUpError } = await signUp(form.email, form.password, captchaToken);
      if (signUpError) {
        setError(authErrorMessage(signUpError));
        return;
      }
      // Mismo mensaje exista o no el email, para no revelar qué cuentas existen.
      setSentTo(form.email);
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  if (sentTo) {
    return (
      <div className="auth-card">
        <h1>Revisá tu email</h1>
        <p className="muted">
          Si <strong>{sentTo}</strong> no tenía una cuenta, te enviamos un link para confirmarla. Después de
          confirmar vas a verificar tu identidad con tu DNI.
        </p>
        <p className="muted">¿Ya confirmaste? <Link to="/login">Ingresá</Link></p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Creá tu cuenta</h1>
      <p className="age-notice">+1 es solo para mayores de 18 años.</p>
      <p className="muted">
        Después de confirmar tu email vas a verificar tu identidad con tu DNI, para que todos sepan con quién se
        juntan.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <label>
          Email
          <input required type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </label>
        <label>
          Contraseña
          <input
            required
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </label>
        <ul className="password-rules" aria-live="polite">
          {rules.map((rule) => (
            <li key={rule.id} className={rule.ok ? 'ok' : ''}>
              {rule.ok ? '✓' : '·'} {rule.label}
            </li>
          ))}
        </ul>
        <label>
          Repetí la contraseña
          <input
            required
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
          />
        </label>
        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
      <GoogleSignInButton />
      <p className="muted">¿Ya tenés cuenta? <Link to="/login">Ingresá</Link></p>
    </div>
  );
}
