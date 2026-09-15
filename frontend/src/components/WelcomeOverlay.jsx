import { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo.jsx';

// Ajustá estos valores para cambiar sensibilidad/intensidad del gesto.
const BG_FACTOR = 0.25; // qué tan lento se mueve el fondo respecto al dedo
const MID_FACTOR = 0.5; // capa media (chips + partículas)
const CONTENT_FACTOR = 0.85; // logo + frase principal
const INDICATOR_FACTOR = 1.1; // indicador de swipe (el más "cercano")
const COMMIT_THRESHOLD = 0.45; // % de la altura de pantalla para completar el swipe solo
const PROGRESS_DISTANCE_RATIO = 0.6; // a qué % de la pantalla la animación llega al 100%
const SETTLE_MS = 420; // duración de la animación de cierre/cancelación

const CHIPS = [
  { label: '⚽ Deportes', top: '16%', left: '8%' },
  { label: '🎶 Música', top: '12%', left: '64%' },
  { label: '🥂 Salidas', top: '60%', left: '70%' },
  { label: '🎲 Trivia', top: '66%', left: '6%' },
];

export function WelcomeOverlay({ onEnter, revealTargetRef }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const overlayRef = useRef(null);
  const bgRef = useRef(null);
  const midRef = useRef(null);
  const contentRef = useRef(null);
  const indicatorRef = useRef(null);

  const dragging = useRef(false);
  const startY = useRef(0);
  const deltaY = useRef(0);
  const rafId = useRef(null);
  const vh = useRef(window.innerHeight);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.body.style.overflow = 'hidden';
    applyProgress(0);
    return () => {
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rawFraction() {
    return vh.current > 0 ? deltaY.current / vh.current : 0;
  }

  function visualProgress() {
    return Math.min(rawFraction() / PROGRESS_DISTANCE_RATIO, 1);
  }

  function applyProgress(progress) {
    const p = Math.min(Math.max(progress, 0), 1);
    const h = vh.current;

    if (bgRef.current) bgRef.current.style.transform = `translateY(${-p * h * BG_FACTOR}px)`;
    if (midRef.current) {
      midRef.current.style.transform = `translateY(${-p * h * MID_FACTOR}px)`;
      midRef.current.style.opacity = String(Math.max(0, 1 - p * 1.4));
    }
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${-p * h * CONTENT_FACTOR}px) scale(${1 + p * 0.06})`;
      contentRef.current.style.opacity = String(Math.max(0, 1 - p * 1.2));
    }
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `translateY(${-p * h * INDICATOR_FACTOR}px)`;
      indicatorRef.current.style.opacity = String(Math.max(0, 1 - p * 3));
    }
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(Math.max(0, 1 - p * 1.05));
      overlayRef.current.style.pointerEvents = p > 0.96 ? 'none' : 'auto';
    }
    if (revealTargetRef?.current) {
      revealTargetRef.current.style.filter = `blur(${(1 - p) * 8}px) brightness(${0.86 + p * 0.14})`;
      revealTargetRef.current.style.transform = `scale(${0.94 + p * 0.06})`;
    }
  }

  function scheduleApply(progress) {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      applyProgress(progress);
    });
  }

  function handlePointerDown(e) {
    dragging.current = true;
    startY.current = e.clientY;
    deltaY.current = 0;
    try {
      overlayRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Algunos navegadores no soportan pointer capture; el gesto sigue funcionando igual.
    }
  }

  function handlePointerMove(e) {
    if (!dragging.current) return;
    const raw = startY.current - e.clientY; // positivo = deslizó hacia arriba
    deltaY.current = Math.max(0, raw);
    scheduleApply(visualProgress());
  }

  function settle(commit) {
    setReleasing(true);
    if (revealTargetRef?.current) {
      revealTargetRef.current.style.transition = `filter ${SETTLE_MS}ms ease, transform ${SETTLE_MS}ms ease`;
    }
    requestAnimationFrame(() => applyProgress(commit ? 1 : 0));
    setTimeout(() => {
      setReleasing(false);
      if (commit) onEnter?.();
      // Limpiar filter/transform es clave: si queda cualquier valor (incluso "neutro"),
      // este contenedor pasa a ser el origen de referencia para los position:fixed de
      // adentro (como la barra inferior), en vez del viewport.
      if (revealTargetRef?.current) {
        revealTargetRef.current.style.transition = '';
        revealTargetRef.current.style.filter = '';
        revealTargetRef.current.style.transform = '';
      }
    }, SETTLE_MS);
  }

  function handlePointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    settle(rawFraction() >= COMMIT_THRESHOLD);
  }

  return (
    <div
      ref={overlayRef}
      className={`welcome-overlay ${releasing ? 'settling' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div ref={bgRef} className="w-bg">
        <span className="w-blob w-blob-1" />
        <span className="w-blob w-blob-2" />
        <span className="w-blob w-blob-3" />
      </div>

      <div ref={midRef} className="w-mid">
        {CHIPS.map((chip) => (
          <span key={chip.label} className="w-chip" style={{ top: chip.top, left: chip.left }}>
            {chip.label}
          </span>
        ))}
        <span className="w-spark w-spark-1" />
        <span className="w-spark w-spark-2" />
        <span className="w-spark w-spark-3" />
      </div>

      <div ref={contentRef} className="w-content">
        <div className="w-logo"><Logo size={72} /></div>
        <h1 className="w-headline">Siempre hay lugar para <span>uno más</span>.</h1>
        <p className="w-sub">Planes, gente nueva y la excusa perfecta para salir de la rutina.</p>
      </div>

      <div ref={indicatorRef} className="w-indicator">
        <span className="w-chevron" />
        <span>Deslizá para descubrir</span>
      </div>
    </div>
  );
}
