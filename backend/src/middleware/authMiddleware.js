import { supabaseAnon } from '../config/supabaseClient.js';

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

// Va después de requireAuth. En el MVP la única verificación obligatoria es el email confirmado.
// Se lee de email_confirmed_at del usuario que devuelve Supabase Auth (auth.getUser valida el
// token contra el servidor), nunca de algo que mande el cliente. La identidad ARCA no participa.
// La base lo vuelve a exigir (is_account_enabled / can_join_event / respond_to_request).
export function requireConfirmedEmail(req, res, next) {
  if (!req.user?.email_confirmed_at) {
    return res.status(403).json({
      error: 'Confirmá tu email para usar esta función. Revisá tu bandeja de entrada.',
      code: 'email_not_confirmed',
    });
  }
  next();
}
