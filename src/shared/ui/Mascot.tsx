import { useMemo } from 'react';
import {
  mascotStore,
  MascotState,
  MASCOT_SPRITE,
  MASCOT_FALLBACK,
  MASCOT_ANIM,
  MASCOT_DEFAULT_MSG,
} from '../../stores/mascotStore';

const CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#34d399', '#818cf8', '#f472b6', '#60a5fa', '#fb923c'];

interface MascotProps {
  /** Modo controlado: ignore o store e use estes valores (ou use chamadas de função via store). */
  state?: MascotState;
  message?: string;
  /** Tamanho da caixa quadrada do personagem (px). */
  size?: number;
  /** Balão posicionado à esquerda (modo flutuante) ou acima (inline). */
  variant?: 'inline' | 'floating';
  /** Exibir partículas de confete no estado success. */
  confetti?: boolean;
  /** Exibir o balão de fala. */
  speech?: boolean;
  /** Modo meditação: respiração lenta e contínua (ignora a animação padrão do estado). */
  breathing?: boolean;
  /** Modo tutorial: personagem simulando fala (boca se movendo + barras de áudio). */
  talking?: boolean;
}

interface Particle {
  left: number;
  mx: number;
  my: number;
  rot: number;
  color: string;
  delay: number;
}

function makeConfetti(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 70;
    return {
      left: 50 + Math.random() * 40 - 20,
      mx: Math.cos(angle) * dist,
      my: Math.sin(angle) * dist - 30,
      rot: (Math.random() * 2 - 1) * 300,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.3,
    };
  });
}

export function Mascot({
  state: controlledState,
  message: controlledMessage,
  size = 84,
  variant = 'inline',
  confetti = true,
  speech = true,
  breathing = false,
  talking = false,
}: MascotProps) {
  const storeState = mascotStore((s) => s.state);
  const storeMessage = mascotStore((s) => s.message);
  const messageId = mascotStore((s) => s.messageId);

  /* Estado efetivo: prop controlada > store (não controlado) */
  const state: MascotState = controlledState ?? storeState;
  const isControlled = controlledState !== undefined;

  const sprite = MASCOT_SPRITE[state];
  const animClass = MASCOT_ANIM[state];
  const talkClass = talking ? 'mascot-anim-talk' : '';
  const breathClass = breathing ? 'mascot-anim-breathing' : '';
  const defaultMsg = MASCOT_DEFAULT_MSG[state];
  const bubbleText = controlledMessage !== undefined
    ? controlledMessage
    : storeMessage ?? defaultMsg;

  /* "rev" dispara efeitos transitórios (confete/sprite) a cada mudança real */
  const rev = isControlled ? `${state}:${bubbleText}` : messageId;

  const showConfetti = confetti && state === 'success';
  const particles = useMemo(
    () => (showConfetti ? makeConfetti(16) : []),
    [showConfetti, rev], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isLoading = state === 'loading';

  return (
    <div
      className={`mascot-container ${animClass} ${breathClass} ${talkClass} ${variant === 'floating' ? 'mascot-up-top' : ''}`}
      style={{ width: size, height: size }}
      aria-label="Mascote do Midnight Mentor"
      role="img"
    >
      <div className="mascot-shadow" />

      {/* Sprint keyed por estado -> dispara a microinteração de entrada */}
      <div key={`${rev}:${sprite}`} className="mascot-sprite-entry">
        <img
          src={sprite}
          alt=""
          draggable={false}
          className="mascot-img"
          onError={(e) => {
            if (e.currentTarget.src !== MASCOT_FALLBACK) e.currentTarget.src = MASCOT_FALLBACK;
          }}
        />
      </div>

      {/* Confete na comemoração */}
      {showConfetti &&
        particles.map((p, i) => (
          <span
            key={`c-${rev}-${i}`}
            className="mascot-confetti"
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              ['--mx' as never]: `${p.mx}px`,
              ['--my' as never]: `${p.my}px`,
              ['--rot' as never]: `${p.rot}deg`,
            }}
          />
        ))}

      {/* Balão de fala */}
      {speech && (
        <div
          key={`bubble-${rev}`}
          className={variant === 'floating' ? 'mascot-bubble mascot-bubble--floating' : 'mascot-bubble'}
        >
          <span className="mascot-bubble-text">{bubbleText}</span>
          {talking && (
            <span className="mm-talk-bars" aria-label="Falando">
              <span /><span /><span /><span />
            </span>
          )}
          {isLoading && (
            <span className="mascot-dots" aria-label="Pensando">
              <span /><span /><span />
            </span>
          )}
        </div>
      )}

      {/* Halos de respiração da meditação */}
      {breathing && (
        <>
          <span className="mm-breathe-ring" />
          <span className="mm-breathe-ring mm-breathe-ring--2" />
          <span className="mm-breathe-ring mm-breathe-ring--3" />
        </>
      )}
    </div>
  );
}