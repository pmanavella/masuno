import { ProfileModel } from '../models/ProfileModel.js';

// declared: datos que el usuario declaró al registrarse (no verificados oficialmente).
export async function getMyProfile(req, res, next) {
  try {
    const [profile, declared] = await Promise.all([
      ProfileModel.getById(req.accessToken, req.user.id),
      ProfileModel.getDeclaredIdentity(req.accessToken),
    ]);
    res.json({ ...profile, email: req.user.email, emailConfirmed: Boolean(req.user.email_confirmed_at), declared });
  } catch (err) {
    next(err);
  }
}

// Solo el teléfono es editable: nombre, DNI, fecha de nacimiento y género se declaran al
// registrarse y no se cambian desde la app.
export async function updateMyProfile(req, res, next) {
  try {
    const { phone } = req.body;
    const profile = await ProfileModel.update(req.accessToken, req.user.id, { phone });
    res.json({ ...profile, email: req.user.email });
  } catch (err) {
    next(err);
  }
}
