import { useMemo } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { AnimatedNumber } from './AnimatedNumber';
import { brilhoPulsante, celebracao, springTap } from '../lib/motionPresets';

const CONFETTI_COLORS = ['#f3b53f', '#e9a11c', '#97d3a2', '#86a2f2', '#e0919e', '#a4baf6', '#a4baf6'];

interface Confetti {
  left: number;
  mx: number;
  my: number;
  rot: number;
  color: string;
  delay: number;
}

function makeConfetti(n: number): Confetti[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 90;
    return {
      left: 18 + Math.random() * 64,
      mx: Math.cos(angle) * dist,
      my: Math.sin(angle) * dist + 20,
      rot: (Math.random() * 2 - 1) * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.35,
    };
  });
}

interface XpMilestoneProps {
  open: boolean;
  xp: number;
  acertos: number;
  total: number;
  onClose: () => void;
  /**
   * true  -> marco de lição (sagui pulando de alegria + confete)
   * false -> aprovação de etapa (sagui no tablet com balão de aprovação)
   */
  approval?: boolean;
  /** Mensagem exibida no balão de aprovação (apenas quando approval). */
  approvalMessage?: string;
}

function comentarioDoResultado(acertos: number, total: number): string {
  if (total <= 0) return '';
  const taxa = acertos / total;
  if (taxa >= 0.8) return 'Mandou muito bem.';
  if (taxa >= 0.5) return 'Bom caminho.';
  return 'Errar aqui é o que evita errar na prova.';
}

export function XpMilestone({ open, xp, acertos, total, onClose, approval = false, approvalMessage = 'Etapa concluída! Você acertou em cheio. ' }: XpMilestoneProps) {
  const reduzir = useReducedMotion();
  const confetti = useMemo(
    () => (open && !approval && !reduzir ? makeConfetti(22) : []),
    [open, approval, reduzir],
  );

  return (
    <AnimatePresence>
      {open && (
    <m.div
      className="fixed inset-0 z-[320] flex items-center justify-center p-4"
      style={{ background: 'rgba(16, 15, 13, 0.86)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Confete explodindo ao redor */}
      {confetti.map((c, i) => (
        <span
          key={`mc-${i}`}
          className="mm-milestone-confetti"
          style={{
            top: '45%',
            left: `${c.left}%`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            ['--mx' as never]: `${c.mx}px`,
            ['--my' as never]: `${c.my}px`,
            ['--rot' as never]: `${c.rot}deg`,
          }}
        />
      ))}

      <m.div
        className="relative w-full max-w-md"
        variants={reduzir ? undefined : celebracao}
        initial={reduzir ? false : 'inicial'}
        animate={reduzir ? undefined : 'animar'}
      >
        {/* Sagui caindo do topo: alegria (XP) ou tablet com balão (aprovação) */}
        <div className="mm-mascot-drop relative mx-auto -mb-16 z-10" style={{ width: 150, height: 150 }}>
          <img
            src={approval ? '/assets/sagui_aprovacao_2.png' : '/assets/sagui_pulando_2.png'}
            alt={approval ? 'Sagui aprovando a etapa no tablet' : 'Sagui pulando de alegria'}
            draggable={false}
            className="relative w-full h-full object-contain drop-shadow-2xl"
          />
          {/* Balão de aprovação em etapas */}
          {approval && (
            <div className="mm-approval-bubble absolute -right-8 -top-6 sm:right-0">
              <span>{approvalMessage}</span>
            </div>
          )}
        </div>

        {/* XP saltando no centro da tela */}
        <div className="camada rounded-3xl p-8 text-center relative overflow-visible">
          <div className="relative inline-flex items-center justify-center mt-10">
            <m.div
              className="mm-milestone-glow"
              variants={reduzir ? undefined : brilhoPulsante}
              initial={reduzir ? false : 'inicial'}
              animate={reduzir ? undefined : 'animar'}
            />
            <div className="mm-xp-pop relative z-10 flex flex-col items-center">
              <span className="numero text-5xl md:text-6xl text-amber-400">+<AnimatedNumber value={xp} /></span>
              <span className="text-sm font-medium text-gray-300 mt-1">XP</span>
            </div>
          </div>

          {/* O elogio acompanha o resultado: "Que maravilha!" aparecia
              também para 1 acerto em 3. */}
          <p className="mt-4 text-sm text-gray-300">
            Você acertou <span className="text-white font-semibold">{acertos}</span> de{' '}
            <span className="text-white font-semibold">{total}</span>. {comentarioDoResultado(acertos, total)}
          </p>

          <m.button
            onClick={onClose}
            className="btn-primary px-8 mt-6"
            whileTap={reduzir ? undefined : { scale: 0.96 }}
            transition={springTap}
          >
            Continuar
          </m.button>
        </div>
      </m.div>
    </m.div>
      )}
    </AnimatePresence>
  );
}