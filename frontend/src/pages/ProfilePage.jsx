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

// Perfil propio. Los datos personales son los declarados al registrarse (DNI enmascarado): no
// están verificados oficialmente y no se editan. Lo único editable es el teléfono.
export function ProfilePage() {
  const { user, signOut } = useAuth();
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
      setProfile((current) => ({ ...current, ...updated }));
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
  if (!profile) return <div className="card">Cargando perfil...</div>;

  // Cuentas creadas sin el formulario de registro (dashboard, Google) no tienen datos declarados.
  const person = profile.declared;
  const initials = person ? `${person.first_name[0]}${person.last_name[0]}`.toUpperCase() : user.email[0].toUpperCase();

  return (
    <div className="profile-hero">
      <div className="avatar-lg">{initials}</div>
      <h1>{person ? `${person.first_name} ${person.last_name}` : user.email}</h1>
      {person && <p className="muted">{person.age} años · Córdoba</p>}
      {profile.emailConfirmed && <p className="verified-badge">✓ Email confirmado</p>}

      <div className="info-list">
        <div className="info-row"><span>Email</span><span>{user.email}</span></div>
        {person ? (
          <>
            <div className="info-row"><span>DNI</span><span>{person.dni_masked}</span></div>
            <div className="info-row"><span>Fecha de nacimiento</span><span>{formatDate(person.birth_date)}</span></div>
            <div className="info-row"><span>Género</span><span>{genderLabel(person.gender)}</span></div>
          </>
        ) : (
          <p className="error-text">Tu cuenta no tiene cargados tus datos personales. Escribinos para completarlos.</p>
        )}

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

      {person && (
        <p className="privacy-note on-dark">
          Datos declarados por vos al registrarte. 🔒 Tu DNI y fecha de nacimiento solo los ves vos. Los demás ven
          "{person.first_name.split(' ')[0]} {person.last_name[0].toUpperCase()}.".
        </p>
      )}
      <button className="btn-ghost on-dark" type="button" onClick={handleLogout}>Cerrar sesión</button>
    </div>
  );
}
