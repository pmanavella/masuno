// Réplica en el cliente de la política de contraseñas configurada en Supabase Auth
// (mínimo 8, minúscula, mayúscula, número y símbolo). Supabase la vuelve a exigir en el
// servidor; esto es para avisarle al usuario antes de enviar.

// Mismo conjunto de símbolos que acepta Supabase Auth.
const SYMBOLS = '!@#$%^&*()_+-=[]{};\':"|<>?,./`~';

export const PASSWORD_RULES = [
  { id: 'length', label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'Una minúscula', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'Una mayúscula', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Un número', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: `Un símbolo (${SYMBOLS})`, test: (p) => [...p].some((c) => SYMBOLS.includes(c)) },
];

export function checkPasswordRules(password) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) }));
}

export function passwordMeetsRules(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

async function sha1Hex(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Consulta HaveIBeenPwned por k-anonymity: solo viajan los primeros 5 caracteres del SHA-1,
// nunca la contraseña ni el hash completo. Add-Padding hace que todas las respuestas tengan
// un tamaño parecido; las entradas de relleno vienen con conteo 0 y se ignoran.
// Devuelve cuántas veces apareció en filtraciones (0 = no apareció), o null si no se pudo
// consultar: en ese caso no se bloquea el registro (es una protección extra, no la única).
export async function pwnedCount(password, { fetchImpl = fetch } = {}) {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Una línea por hash: "SUFIJO:CONTEO" (sufijo = hash desde el carácter 6), separadas por CRLF.
    for (const line of text.split(/\r?\n/)) {
      const [lineSuffix, count] = line.trim().split(':');
      if (lineSuffix?.toUpperCase() === suffix) return Number.parseInt(count, 10) || 0;
    }
    return 0;
  } catch {
    return null;
  }
}
