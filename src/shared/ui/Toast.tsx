import { useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { springPainel } from '../lib/motionPresets';

/* Superfície da camada com a cor só na margem e no ícone: o fundo
   âmbar do aviso "info" competia com o botão principal da tela, que é
   o único âmbar que deveria chamar o olho. */
const ESTILO = {
  success: 'border-l-emerald-400 [&_svg]:text-emerald-400',
  error: 'border-l-red-400 [&_svg]:text-red-400',
  info: 'border-l-tinta-400 [&_svg]:text-tinta-400',
} as const;

/* Erro fica mais tempo: precisa ser lido, e às vezes copiado. */
const DURACAO = { success: 3000, info: 3500, error: 7000 } as const;

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
    const timer = setTimeout(clearToast, DURACAO[toastType] ?? 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, toastType, clearToast]);

  const Icone = ICONE[toastType];

  return (
    <AnimatePresence>
      {toastMessage && (
        <m.div
          key={toastMessage}
          /* Erro interrompe o leitor de tela (alert); o resto espera a vez. */
          role={toastType === 'error' ? 'alert' : 'status'}
          aria-live={toastType === 'error' ? 'assertive' : 'polite'}
          layout
          initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
          animate={reduzir ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={reduzir ? { duration: 0.15 } : springPainel}
          className={`camada fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[min(28rem,calc(100vw-2rem))] flex items-start gap-3 pl-4 pr-2 py-3 rounded-lg border-l-[3px] text-sm text-gray-100 ${ESTILO[toastType]}`}
        >
          <Icone size={17} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{toastMessage}</span>
          <button onClick={clearToast} className="shrink-0 -my-1 w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white" aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
