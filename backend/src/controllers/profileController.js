import { ProfileModel } from '../models/ProfileModel.js';

export async function getMyProfile(req, res, next) {
  try {
    const profile = await ProfileModel.getById(req.accessToken, req.user.id);
    res.json({ ...profile, email: req.user.email });
  } catch (err) {
    next(err);
  }
}

// Solo el teléfono es editable: nombre, DNI y fecha de nacimiento salen de la verificación.
export async function updateMyProfile(req, res, next) {
  try {
    const { phone } = req.body;
    const profile = await ProfileModel.update(req.accessToken, req.user.id, { phone });
    res.json({ ...profile, email: req.user.email });
  } catch (err) {
    next(err);
  }
}
