import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TurnstileWidget } from '../components/TurnstileWidget.jsx';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';
import { api } from '../lib/apiClient.js';
import { checkPasswordRules, pwnedCount } from '../lib/passwordPolicy.js';
import { authErrorMessage } from '../lib/authErrors.js';
import { PERSON_GENDERS, genderLabel } from '../lib/genders.js';
import { latestAdultBirthDate, validateRegistrationForm } from '../lib/registration.js';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  dni: '',
  birthDate: '',
  gender: '',
  email: '',
  password: '',
  confirmPassword: '',
};

// Crea la cuenta desde el backend (valida los datos y llama a Supabase Auth). Los datos personales
// quedan como declarados: no se verifican contra ARCA. La cuenta se habilita al confirmar el email.
export function RegisterPage() {
  const turnstileRef = useRef(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  // 'form' | 'validating' | 'creating'
  const [status, setStatus] = useState('form');
  const [sentTo, setSentTo] = useState('');
  const maxBirthDate = latestAdultBirthDate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  }

  const rules = checkPasswordRules(form.password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const { errors, values } = validateRegistrationForm(form);
    if (!captchaToken) errors.captcha = 'Completá la verificación de seguridad.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Revisá los campos marcados.');
      return;
    }

    try {
      setStatus('validating');
      const leaks = await pwnedCount(values.password);
      if (leaks > 0) {
        setFieldErrors({ password: 'Esta contraseña apareció en filtraciones de datos. Elegí otra.' });
        return;
      }

      setStatus('creating');
      await api.register({ ...values, captchaToken });
      // Mismo mensaje exista o no el email, para no revelar qué cuentas existen.
      setSentTo(values.email);
    } catch (err) {
      if (err.field) setFieldErrors({ [err.field]: err.message });
      setError(err.field ? 'Revisá los campos marcados.' : authErrorMessage(err));
    } finally {
      setStatus('form');
      turnstileRef.current?.reset();
    }
  }

  if (sentTo) {
    return (
      <div className="auth-card">
        <h1>Revisá tu email</h1>
        <p className="muted">
          Si <strong>{sentTo}</strong> no tenía una cuenta, te enviamos un link para confirmarla. Cuando la confirmes
          vas a poder crear eventos y sumarte a planes.
        </p>
        <p className="muted">¿No te llegó? Revisá la carpeta de spam.</p>
        <p className="muted">¿Ya confirmaste? <Link to="/login">Ingresá</Link></p>
      </div>
    );
  }

  const busy = status !== 'form';
  const fieldError = (field) => fieldErrors[field] && <p className="error-text">{fieldErrors[field]}</p>;

  return (
    <div className="auth-card">
      <h1>Creá tu cuenta</h1>
      <p className="age-notice">+1 es solo para mayores de 18 años.</p>
      <form onSubmit={handleSubmit} noValidate>
        <label>
          Nombre(s)
          <input required autoComplete="given-name" maxLength={100} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
        </label>
        {fieldError('firstName')}
        <label>
          Apellido(s)
          <input required autoComplete="family-name" maxLength={100} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
        </label>
        {fieldError('lastName')}
        <label>
          DNI
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej.: 30.123.456"
            maxLength={11}
            value={form.dni}
            onChange={(e) => update('dni', e.target.value)}
          />
        </label>
        {fieldError('dni')}
        <label>
          Fecha de nacimiento
          <input
            required
            type="date"
            max={maxBirthDate}
            autoComplete="bday"
            value={form.birthDate}
            onChange={(e) => update('birthDate', e.target.value)}
          />
        </label>
        {fieldError('birthDate')}
        <label>
          Género (autopercibido)
          <select required value={form.gender} onChange={(e) => update('gender', e.target.value)}>
            <option value="" disabled>Elegí una opción</option>
            {PERSON_GENDERS.map((g) => (
              <option key={g} value={g}>{genderLabel(g)}</option>
            ))}
          </select>
        </label>
        {fieldError('gender')}
        <label>
          Email
          <input required type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </label>
        {fieldError('email')}
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
        {fieldError('password')}
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
        {fieldError('confirmPassword')}
        <p className="privacy-note">
          🔒 Tu DNI y tu fecha de nacimiento solo los ves vos (Ley 25.326). Los demás ven tu nombre y la inicial de tu
          apellido. Un DNI se puede usar en una sola cuenta.
        </p>
        <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} />
        {fieldError('captcha')}
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary btn-block" type="submit" disabled={busy}>
          {status === 'validating' ? 'Validando...' : status === 'creating' ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
      <GoogleSignInButton />
      <p className="muted">¿Ya tenés cuenta? <Link to="/login">Ingresá</Link></p>
    </div>
  );
}
