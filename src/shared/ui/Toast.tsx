import { useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { springPainel } from '../lib/motionPresets';

const ESTILO = {
  success: 'bg-emerald-600/90 border-emerald-500/30 text-emerald-50',
  error: 'bg-red-600/90 border-red-500/30 text-red-50',
  info: 'bg-amber-600/90 border-amber-500/30 text-amber-50',
} as const;

const ICONE = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

/**
 * Aviso temporário.
 *
 * Antes retornava `null` quando não havia mensagem, então o toast sumia
 * num corte seco. Com `AnimatePresence` ele sai com fade, e a entrada por
 * spring dá o mesmo peso físico do resto da interface.
 */
export function Toast() {
  const toastMessage = useAppStore((s) => s.toastMessage);
  const toastType = useAppStore((s) => s.toastType);
  const clearToast = useAppStore((s) => s.clearToast);
  const reduzir = useReducedMotion();

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(clearToast, 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  const Icone = ICONE[toastType];

  return (
    <AnimatePresence>
      {toastMessage && (
        <m.div
          key={toastMessage}
          role="status"
          aria-live="polite"
          layout
          initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
          animate={reduzir ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={reduzir ? { duration: 0.15 } : springPainel}
          className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-2xl border shadow-lg backdrop-blur-xl font-medium text-sm ${ESTILO[toastType]}`}
        >
          <Icone size={17} className="shrink-0" />
          {toastMessage}
        </m.div>
      )}
    </AnimatePresence>
  );
}
