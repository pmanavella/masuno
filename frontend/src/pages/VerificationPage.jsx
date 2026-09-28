import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/apiClient.js';
import { PERSON_GENDERS, genderLabel } from '../lib/genders.js';

const MIN_AGE = 18;

// Fecha de hace 18 años (YYYY-MM-DD, hora local): tope del selector de fecha.
function latestAdultBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function VerificationPage() {
  const { identityStatus, refreshIdentity, signOut } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [form, setForm] = useState({ dni: '', firstName: '', lastName: '', birthDate: '', gender: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const maxBirthDate = latestAdultBirthDate();

  if (identityStatus === 'verified') return <Navigate to="/perfil" replace />;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const dni = form.dni.replace(/[\s.]/g, '');
    if (!/^\d{7,8}$/.test(dni)) {
      setError('Ingresá tu DNI: 7 u 8 números, sin puntos.');
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Completá tu nombre y apellido.');
      return;
    }
    if (!form.birthDate) {
      setError('Completá tu fecha de nacimiento.');
      return;
    }
    // El backend y la base lo vuelven a validar; esto es para avisar sin gastar un intento.
    if (form.birthDate > maxBirthDate) {
      setError('+1 es solo para mayores de 18 años.');
      return;
    }
    if (!form.gender) {
      setError('Elegí tu género.');
      return;
    }

    setLoading(true);
    try {
      await api.verifyIdentity({ ...form, dni });
      await refreshIdentity();
      showToast('¡Identidad verificada!');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Verificá tu identidad</h1>
      <p className="age-notice">+1 es solo para mayores de 18 años.</p>
      <p className="muted">
        Validamos tus datos con el padrón de ARCA para que todos sepan con quién se juntan. Escribilos tal como
        figuran en tu DNI.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <label>
          DNI
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="Sin puntos"
            maxLength={10}
            value={form.dni}
            onChange={(e) => update('dni', e.target.value)}
          />
        </label>
        <label>
          Nombre(s)
          <input required autoComplete="given-name" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
        </label>
        <label>
          Apellido(s)
          <input required autoComplete="family-name" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
        </label>
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
        <label>
          Género (autopercibido)
          <select required value={form.gender} onChange={(e) => update('gender', e.target.value)}>
            <option value="" disabled>Elegí una opción</option>
            {PERSON_GENDERS.map((g) => (
              <option key={g} value={g}>{genderLabel(g)}</option>
            ))}
          </select>
        </label>
        <p className="privacy-note">
          🔒 Tu DNI, CUIL y fecha de nacimiento solo los ves vos (Ley 25.326). Los demás ven tu nombre y la inicial
          de tu apellido.
        </p>
        {error && <p className="error-text">{error}</p>}
        <button className="btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Verificando...' : 'Verificar identidad'}
        </button>
      </form>
      <p className="muted">
        ¿No sos vos? <button type="button" className="btn-ghost" onClick={signOut}>Cerrar sesión</button>
      </p>
    </div>
  );
}
