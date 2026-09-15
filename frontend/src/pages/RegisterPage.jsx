import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/apiClient.js';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '', dni: '', birthDate: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      // dni y phone se guardan sin validar; ver TODO en backend/src/models/ProfileModel.js
      const { data, error: signUpError } = await signUp(form.email, form.password);
      if (signUpError) throw signUpError;

      if (data.session) {
        await api.updateProfile({
          fullName: form.fullName,
          phone: form.phone,
          dni: form.dni,
          birthDate: form.birthDate,
        });
        navigate('/');
      } else {
        setInfo('Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión para completar tu perfil.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Creá tu cuenta</h1>
      <p className="muted">Lo mínimo para que todos confíen en quién organiza y quién participa.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre y apellido
          <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
        </label>
        <label>
          Email
          <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </label>
        <label>
          Contraseña
          <input required type="password" minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} />
        </label>
        <label>
          DNI
          <input required value={form.dni} onChange={(e) => update('dni', e.target.value)} />
        </label>
        <label>
          Teléfono
          <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </label>
        <label>
          Fecha de nacimiento
          <input required type="date" value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        {info && <p className="info-text">{info}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creando cuenta...' : 'Ingresar a +1'}
        </button>
      </form>
      <p className="muted">¿Ya tenés cuenta? <Link to="/login">Ingresá</Link></p>
    </div>
  );
}
