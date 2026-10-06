import { AccountModel } from '../models/AccountModel.js';
import { allowedOrigins } from '../config/origins.js';
import { registerAccount } from '../services/registrationService.js';

// El link del email de confirmación vuelve al frontend desde el que se registró (si es uno de
// los permitidos). Supabase además exige que esté en Auth > URL Configuration > Redirect URLs.
function confirmationRedirectFor(req) {
  const origin = req.get('origin');
  return `${allowedOrigins.includes(origin) ? origin : allowedOrigins[0]}/`;
}

// Siempre la misma respuesta si el alta se aceptó, exista o no el email (no se revela).
export async function register(req, res, next) {
  try {
    await registerAccount({ body: req.body, redirectTo: confirmationRedirectFor(req) }, { model: AccountModel });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
