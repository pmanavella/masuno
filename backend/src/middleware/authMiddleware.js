import { supabaseAnon, supabaseForUser } from '../config/supabaseClient.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function requireAuth(req, res, next) {
  const token = bearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de autenticación' });
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  req.user = data.user;
  req.accessToken = token;
  next();
}

// Para rutas públicas: si viene un token válido se usa (las consultas respetan RLS como ese
// usuario); si no viene o es inválido, sigue como anónimo en vez de responder 401.
export async function optionalAuth(req, res, next) {
  const token = bearerToken(req);
  if (token) {
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (!error && data?.user) {
      req.user = data.user;
      req.accessToken = token;
    }
  }
  next();
}

// Va después de requireAuth. Una cuenta sin identidad verificada solo puede verificarse.
export async function requireVerified(req, res, next) {
  const { data, error } = await supabaseForUser(req.accessToken).rpc('is_verified');
  if (error) return next(error);
  if (data !== true) {
    return res.status(403).json({ error: 'Tenés que verificar tu identidad primero.', code: 'not_verified' });
  }
  next();
}
