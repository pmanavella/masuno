import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

function ageFromDob(dobStr) {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', dni: '', birthDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile()
      .then((data) => {
        setProfile(data);
        setForm({
          fullName: data.full_name || '',
          phone: data.phone || '',
          dni: data.dni || '',
          birthDate: data.birth_date || '',
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateProfile(form);
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
  if (!profile) return <div className="card">Cargando perfil...</div>;

  const initials = (profile.full_name || user.email)
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const age = ageFromDob(profile.birth_date);

  return (
    <div className="profile-hero">
      <div className="avatar-lg">{initials}</div>
      <h1>{profile.full_name || 'Sin nombre'}</h1>
      <p className="muted">{age !== null ? `${age} años · Córdoba` : 'Córdoba'}</p>

      {!editing ? (
        <div className="info-list">
          <div className="info-row"><span>Email</span><span>{user.email}</span></div>
          <div className="info-row"><span>DNI</span><span>{profile.dni || '—'}</span></div>
          <div className="info-row"><span>Teléfono</span><span>{profile.phone || '—'}</span></div>
          <div className="info-row"><span>Fecha de nacimiento</span><span>{profile.birth_date || '—'}</span></div>
          <button className="btn-secondary" onClick={() => setEditing(true)}>Editar perfil</button>
          <button className="btn-ghost" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      ) : (
        <form className="card" onSubmit={handleSave}>
          <label>
            Nombre y apellido
            <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </label>
          <label>
            DNI
            <input value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} />
          </label>
          <label>
            Teléfono
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label>
            Fecha de nacimiento
            <input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="cta-row">
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            <button className="btn-ghost" type="button" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
