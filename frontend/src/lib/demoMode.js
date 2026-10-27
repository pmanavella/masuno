// Modo demo (Demo Day): la app arranca en /demo con un usuario ficticio y datos en memoria
// (src/demo/). Se decide una sola vez al cargar la página; fuera de /demo todo sigue igual.
export const DEMO_BASENAME = '/demo';

export const DEMO_MODE =
  typeof window !== 'undefined' &&
  (window.location.pathname === DEMO_BASENAME || window.location.pathname.startsWith(`${DEMO_BASENAME}/`));

export const DEMO_UNAVAILABLE_MESSAGE = 'Esta función no está disponible en la demo.';
