import { RequestModel } from '../models/RequestModel.js';
import { HttpError } from '../utils/HttpError.js';

export async function listMyRequests(req, res, next) {
  try {
    res.json(await RequestModel.listMine(req.user.id, req.accessToken));
  } catch (err) {
    next(err);
  }
}

export async function respondToRequest(req, res, next) {
  try {
    if (typeof req.body?.accept !== 'boolean') {
      throw new HttpError(400, 'invalid_input', 'Falta indicar si aceptás o rechazás.');
    }
    const status = await RequestModel.respond(req.params.id, req.body.accept, req.accessToken);
    res.json({ id: req.params.id, status });
  } catch (err) {
    next(err);
  }
}

export async function cancelRequest(req, res, next) {
  try {
    const status = await RequestModel.cancel(req.params.id, req.accessToken);
    res.json({ id: req.params.id, status });
  } catch (err) {
    next(err);
  }
}
