import { ProfileModel } from '../models/ProfileModel.js';

export async function getMyProfile(req, res, next) {
  try {
    const profile = await ProfileModel.getById(req.accessToken, req.user.id);
    res.json({ ...profile, email: req.user.email });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const { fullName, phone, dni, birthDate } = req.body;
    const profile = await ProfileModel.update(req.accessToken, req.user.id, { fullName, phone, dni, birthDate });
    res.json({ ...profile, email: req.user.email });
  } catch (err) {
    next(err);
  }
}
