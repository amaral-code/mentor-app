import { useEffect } from 'react';
import { m, useReducedMotion, useSpring, useTransform } from 'motion/react';

/**
 * Número que conta até o valor novo.
 *
 * XP que pula de 120 para 140 comunica "mudou". XP que corre de 120 até
 * 140 comunica "você ganhou 20", que é a informação que importa numa tela
 * de gamificação.
 *
 * Usa `useSpring` sobre um MotionValue: o texto é atualizado fora do ciclo
 * de render do React, então contar de 0 a 5000 não dispara 5000 renders.
 */

interface AnimatedNumberProps {
  value: number;
  /** Casas decimais. Padrão inteiro. */
  decimais?: number;
  /** Formata com separador de milhar pt-BR. */
  agrupar?: boolean;
  className?: string;
  /** Texto colado depois do número, dentro do mesmo elemento. */
  sufixo?: string;
}

export function AnimatedNumber({
  value,
  decimais = 0,
  agrupar = false,
  className = '',
  sufixo = '',
}: AnimatedNumberProps) {
  const reduzir = useReducedMotion();

  const mola = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });

  const texto = useTransform(mola, (v) => {
    const n = decimais > 0 ? Number(v.toFixed(decimais)) : Math.round(v);
    return (agrupar ? n.toLocaleString('pt-BR') : String(n)) + sufixo;
  });

  useEffect(() => {
    // Com movimento reduzido, salta direto para o valor final.
    if (reduzir) mola.jump(value);
    else mola.set(value);
  }, [value, reduzir, mola]);

  return (
    <m.span className={`tabular-nums ${className}`}>
      {texto}
    </m.span>
  );
}

/**
 * Barra de progresso animada por scaleX.
 *
 * Animar `width` recalcula layout a cada quadro; `scaleX` roda na GPU.
 * O truque é o `transform-origin: left`, senão a barra cresce do centro.
 */
interface BarraProgressoProps {
  /** 0 a 100. */
  valor: number;
  className?: string;
  /** Classe da barra interna (cor). */
  corClassName?: string;
  altura?: string;
}

export function BarraProgresso({
  valor,
  className = '',
  corClassName = 'bg-amber-500',
  altura = 'h-1.5',
}: BarraProgressoProps) {
  const reduzir = useReducedMotion();
  const pct = Math.max(0, Math.min(100, valor)) / 100;

  return (
    <div
      className={`${altura} rounded-full bg-white/5 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <m.div
        className={`h-full w-full rounded-full origin-left ${corClassName}`}
        initial={false}
        animate={{ scaleX: pct }}
        transition={reduzir ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
