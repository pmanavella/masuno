import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { genderLabel } from '../lib/genders.js';

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin pasar por Date (evita correrse un día por zona horaria).
function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(isoDateTime) {
  return new Date(isoDateTime).toLocaleDateString('es-AR');
}

// Perfil propio. Los datos de identidad vienen de la verificación (enmascarados) y no se
// editan; lo único editable es el teléfono.
export function ProfilePage() {
  const { user, identity, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile()
      .then((data) => {
        setProfile(data);
        setPhone(data.phone || '');
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.updatePhone(phone.trim());
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/');
  }

  if (error && !profile) return <div className="card"><p className="error-text">{error}</p></div>;
  if (!profile || !identity) return <div className="card">Cargando perfil...</div>;

  const initials = `${identity.first_name[0]}${identity.last_name[0]}`.toUpperCase();

  return (
    <div className="profile-hero">
      <div className="avatar-lg">{initials}</div>
      <h1>{identity.first_name} {identity.last_name}</h1>
      <p className="muted">{identity.age} años · Córdoba</p>
      <p className="verified-badge">✓ Identidad verificada</p>

      <div className="info-list">
        <div className="info-row"><span>Email</span><span>{user.email}</span></div>
        <div className="info-row"><span>DNI</span><span>{identity.dni_masked}</span></div>
        <div className="info-row"><span>CUIL</span><span>{identity.cuil_masked}</span></div>
        <div className="info-row"><span>Fecha de nacimiento</span><span>{formatDate(identity.birth_date)}</span></div>
        <div className="info-row"><span>Género</span><span>{genderLabel(identity.gender)}</span></div>
        <div className="info-row"><span>Verificada el</span><span>{formatDateTime(identity.verified_at)}</span></div>

        {!editing ? (
          <div className="info-row">
            <span>Teléfono</span>
            <span className="phone-value">
              {profile.phone || '—'}
              <button className="btn-ghost" type="button" onClick={() => setEditing(true)}>Editar</button>
            </span>
          </div>
        ) : (
          <form className="phone-form" onSubmit={handleSave}>
            <label>
              Teléfono
              <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="cta-row">
              <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setPhone(profile.phone || '');
                  setError('');
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="privacy-note on-dark">
        🔒 Tu DNI, CUIL y fecha de nacimiento solo los ves vos. Los demás ven "{identity.first_name.split(' ')[0]}{' '}
        {identity.last_name[0].toUpperCase()}.".
      </p>
      <button className="btn-ghost on-dark" type="button" onClick={handleLogout}>Cerrar sesión</button>
    </div>
  );
}
