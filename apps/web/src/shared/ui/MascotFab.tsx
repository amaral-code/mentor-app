import { useEffect, useRef } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { springTap } from '../lib/motionPresets';
import { Mascot } from './Mascot';
import { mascotStore } from '../../stores/mascotStore';

const FAB_TIPS = [
  ' Tente encher a barra de XP com um quiz rápido!',
  ' Mantenha seu streak acessando todos os dias.',
  ' A redação vale até 1000 pontos. Não pule!',
  ' Um plano de estudo focado rende mais que horas soltas.',
  ' Modo Foco te ajuda a render melhor no Pomodoro.',
  ' Está cansado? Priorize descanso e retome amanhã.',
  ' Nada acertou? Entenda o porquê de cada erro e evolua!',
];

/**
 * Mascote flutuante (canto da tela).
 * Espelha a máquina de estados global (idle/typing/loading/success/error)
 * alimentada pelo app - ex.: Quiz, level up, streak. O clique dá dicas
 * com um balão transitório via `say()`.
 */
export function MascotFab() {
  const reduzir = useReducedMotion();
  const indexRef = useRef(Math.floor(Math.random() * FAB_TIPS.length));

  useEffect(() => {
    const t = setTimeout(() => {
      mascotStore.getState().say(FAB_TIPS[indexRef.current], 5000);
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  const handleClick = () => {
    indexRef.current = (indexRef.current + 1) % FAB_TIPS.length;
    mascotStore.getState().say(FAB_TIPS[indexRef.current], 4500);
  };

  return (
    <m.div
      className="fixed z-[80] bottom-28 md:bottom-16 md:right-8 right-3 cursor-pointer"
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      role="button"
      tabIndex={0}
      aria-label="Mascote: dicas e reações"
      whileHover={reduzir ? undefined : { scale: 1.05 }}
      whileTap={reduzir ? undefined : { scale: 0.95 }}
      transition={springTap}
    >
      <Mascot size={84} variant="floating" />
    </m.div>
  );
}