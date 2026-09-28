import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Cloudflare Turnstile. Supabase Auth valida el token del lado del servidor cuando el CAPTCHA
// está activado en el dashboard (Attack Protection); sin activarlo, el token se ignora.
// En desarrollo, si no hay VITE_TURNSTILE_SITE_KEY, se usa la clave de prueba de Cloudflare
// que siempre valida (pareja de la clave secreta de prueba 1x0000000000000000000000000000000AA).
const TEST_SITE_KEY = '1x00000000000000000000AA';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TEST_SITE_KEY : '');
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('No se pudo cargar Turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// onToken(token) recibe el token cuando se resuelve el desafío, y null cuando vence o falla.
// El token sirve para un solo intento: después de cada envío hay que llamar a ref.reset().
export const TurnstileWidget = forwardRef(function TurnstileWidget({ onToken }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null);
      if (widgetIdRef.current != null) window.turnstile?.reset(widgetIdRef.current);
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          language: 'es',
          theme: 'light',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) {
    return <p className="error-text">Falta configurar VITE_TURNSTILE_SITE_KEY.</p>;
  }
  return <div ref={containerRef} className="turnstile-box" />;
});
