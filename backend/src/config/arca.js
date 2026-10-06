// ARCA_ENABLED=true activa la verificación de identidad contra ARCA (Padrón A13). Durante el MVP
// va en false (o sin definir): el backend no crea el cliente, no monta /api/identity y nunca
// contacta a ARCA. No hay modo mock: los mocks solo existen en backend/test.
export function isArcaEnabled(env = process.env) {
  const value = String(env.ARCA_ENABLED ?? '').trim().toLowerCase();
  if (value === '' || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error(`ARCA_ENABLED inválido: "${env.ARCA_ENABLED}" (true | false)`);
}
