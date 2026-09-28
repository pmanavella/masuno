import { NotificationModel } from '../models/NotificationModel.js';

export async function listNotifications(req, res, next) {
  try {
    res.json(await NotificationModel.list(req.accessToken));
  } catch (err) {
    next(err);
  }
}

export async function markNotificationsRead(req, res, next) {
  try {
    await NotificationModel.markAllRead(req.accessToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
