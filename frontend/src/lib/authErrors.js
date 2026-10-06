// Traduce los errores de Supabase Auth a mensajes para el usuario. Se usa el código estable
// (error.code) y, si no viene, se cae al mensaje original. También sirve para los errores del
// backend (POST /api/auth/register), que devuelven los mismos códigos.
const MESSAGES = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada (y spam).',
  weak_password: 'La contraseña no cumple los requisitos de seguridad.',
  captcha_failed: 'No pudimos validar que no seas un robot. Probá de nuevo.',
  over_email_send_rate_limit: 'Se enviaron demasiados emails. Esperá unos minutos y probá de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  email_address_invalid: 'Ese email no es válido.',
  signup_disabled: 'El registro está deshabilitado en este momento.',
  email_address_not_authorized: 'Todavía no podemos enviar emails a esa dirección.',
};

export function authErrorMessage(error) {
  if (!error) return '';
  return MESSAGES[error.code] || error.message || 'Ocurrió un error. Probá de nuevo.';
}
