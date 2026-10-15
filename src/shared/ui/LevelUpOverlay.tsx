import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { PartyPopper } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { brilhoPulsante, celebracao, springTap } from '../lib/motionPresets';
const CONFETTI_COLORS = ['#f3b53f', '#e9a11c', '#a4baf6', '#97d3a2', '#e0919e', '#a4baf6', '#a4baf6'];

interface Confetti { left: number; mx: number; my: number; rot: number; color: string; delay: number; }

function makeConfetti(n: number): Confetti[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 110;
    return {
      left: 15 + Math.random() * 70,
      mx: Math.cos(angle) * dist,
      my: Math.sin(angle) * dist + 30,
      rot: (Math.random() * 2 - 1) * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.4,
    };
  });
}

interface LevelUpOverlayProps {
  open: boolean;
  level: number;
  onClose: () => void;
}

export function LevelUpOverlay({ open, level, onClose }: LevelUpOverlayProps) {
  const reduzir = useReducedMotion();
  const confetti = useMemo(() => (open || reduzir ? makeConfetti(reduzir ? 0 : 30) : []), [open, reduzir]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(onClose, 3200);
    }
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
    <m.div
      className="levelup-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Parabéns! Level Up"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {confetti.map((c, i) => (
        <span
          key={i}
          className="levelup-confetti"
          style={{
            top: '42%',
            left: `${c.left}%`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            ['--mx' as never]: `${c.mx}px`,
            ['--my' as never]: `${c.my}px`,
            ['--rot' as never]: `${c.rot}deg`,
          }}
        />
      ))}

      {/* O sagui entra de 0.5 com overshoot: e o pico emocional da sessao,
          o unico momento do app autorizado a passar de 400ms. */}
      <m.div
        className="levelup-inner"
        onClick={(e) => e.stopPropagation()}
        variants={reduzir ? undefined : celebracao}
        initial={reduzir ? { opacity: 0 } : 'inicial'}
        animate={reduzir ? { opacity: 1 } : 'animar'}
        exit={reduzir ? { opacity: 0 } : 'sair'}
      >
        <div className="levelup-badge">
          NÍVEL <AnimatedNumber value={level} />
        </div>

        <div className="levelup-mascot">
          {/* Brilho por opacity, nunca box-shadow: sombra animada repinta
              a arvore inteira a cada quadro. */}
          <m.div
            className="levelup-glow"
            variants={reduzir ? undefined : brilhoPulsante}
            initial={reduzir ? false : 'inicial'}
            animate={reduzir ? undefined : 'animar'}
          />
          <img
            loading="lazy"
            src="/assets/sagui_aprovacao_2.png"
            alt="Sagui comemorando"
            width={160}
            height={160}
            draggable={false}
          />
        </div>

        <h2 className="levelup-title">
          Level up! <PartyPopper size={18} className="inline-block align-[-0.15em] text-amber-400" />
        </h2>
        <p className="levelup-sub">Seu foco te levou mais alto. Continue assim.</p>

        <m.button
          onClick={onClose}
          className="btn-primary levelup-btn"
          whileTap={reduzir ? undefined : { scale: 0.96 }}
          transition={springTap}
        >
          Continuar
        </m.button>
      </m.div>
    </m.div>
      )}
    </AnimatePresence>
  );
}