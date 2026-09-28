import { HttpError } from '../utils/HttpError.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
}
