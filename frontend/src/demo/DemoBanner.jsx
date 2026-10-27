// En local la landing se sirve aparte (ver frontend/.env.example); en producción hay que
// definir VITE_LANDING_URL con la URL de la landing en Vercel.
const LANDING_URL = import.meta.env.VITE_LANDING_URL || (import.meta.env.DEV ? 'http://localhost:5500' : '/');

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <span>Estás usando la demo de +1. Los datos son de ejemplo.</span>
      <a href={LANDING_URL}>Volver al sitio</a>
    </div>
  );
}
