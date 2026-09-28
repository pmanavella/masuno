import { eventError, isUuid } from '../services/eventService.js';

// Un :id que no es UUID no existe (y evita un error de tipos en la base).
export function requireUuidParam(req, res, next) {
  if (!isUuid(req.params.id)) return next(eventError('not_found'));
  next();
}
