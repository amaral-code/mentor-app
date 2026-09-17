import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { GlassCard } from './GlassCard';
import { travarRolagem } from '../lib/scrollLock';
import { popIn } from '../lib/motionPresets';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  fullScreen?: boolean;
}

/**
 * Modal do app.
 *
 * A entrada e a saída ficam centralizadas aqui de propósito: todo overlay
 * que usa este componente (WeeklyReport, NotebookStudio, PersonaManager)
 * herda o mesmo movimento. Antes cada um retornava `null` na saída, então
 * o fechamento era um corte seco, sem transição.
 *
 * `AnimatePresence` é o que torna a saída possível: ele segura o elemento
 * no DOM até a animação terminar.
 */
export function Modal({ open, onClose, children, title, fullScreen }: ModalProps) {
  const reduzir = useReducedMotion();

  /* Trava contada: vários modais (e o drawer do menu) podem estar abertos
     ao mesmo tempo, e escrever direto em `body.style.overflow` fazia o
     primeiro a fechar destravar a página por baixo dos outros. */
  useEffect(() => {
    if (!open) return;
    return travarRolagem();
  }, [open]);

  // Esc fecha, como se espera de qualquer diálogo.
  useEffect(() => {
    if (!open || !onClose) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        /* O respiro lateral é sempre 1rem, mas em cima e embaixo ele cresce
           até a safe-area: no iPhone com notch/barra de gestos, o `p-4` puro
           deixava o topo do diálogo (onde mora o X de fechar) debaixo do
           recorte. */
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <m.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <m.div
            role="dialog"
            aria-modal="true"
            variants={reduzir ? undefined : popIn}
            initial={reduzir ? { opacity: 0 } : 'inicial'}
            animate={reduzir ? { opacity: 1 } : 'animar'}
            exit={reduzir ? { opacity: 0 } : 'sair'}
            /*
             * A altura é medida contra ESTE container (`h-full`/`max-h-full`),
             * nunca contra a viewport. `h-dvh` é a tela inteira, mas o espaço
             * real aqui é a tela menos o respiro acima — a diferença vazava
             * para fora e cortava o topo e o rodapé do diálogo no celular.
             *
             * Funciona porque o pai é `flex` com altura definida (`inset-0`),
             * então a porcentagem resolve. É também por isso que o cartão
             * abaixo é um FLEX ITEM daqui em vez de usar `max-h-full`: contra
             * um pai de altura `auto`, `max-height: 100%` vira `none` e o
             * diálogo voltaria a crescer para fora da tela.
             */
            className={`relative z-10 w-full flex flex-col ${
              fullScreen ? 'max-w-4xl h-full md:h-[90dvh]' : 'max-w-lg max-h-full md:max-h-[85dvh]'
            }`}
          >
            <GlassCard
              className={`flex flex-col min-h-0 overflow-hidden ${fullScreen ? 'flex-1' : ''}`}
              padding="none"
            >
              {/* `shrink-0` + corpo rolável: antes o cartão inteiro rolava,
                  então em conteúdo longo o título e o X saíam de vista. */}
              {title && (
                <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
                  <h2 className="text-base md:text-lg font-bold text-white min-w-0 break-words">{title}</h2>
                  {onClose && (
                    <m.button
                      onClick={onClose}
                      aria-label="Fechar"
                      className="btn-ghost leading-none shrink-0"
                      whileTap={reduzir ? undefined : { scale: 0.92 }}
                    >
                      <X size={18} />
                    </m.button>
                  )}
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
            </GlassCard>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
