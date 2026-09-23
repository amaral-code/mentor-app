import { useEffect, useState } from 'react';
import { CONSCIOUS_PAUSE_SECONDS, formatFocusTime } from './focusLogic';

interface ConsciousPauseOverlayProps {
  /** Controla a visibilidade (gatilho: 3 perdas de foco em 15 min). */
  open: boolean;
  /** Chamado ao clicar em "Retomar Estudo" (só habilitado ao fim do timer). */
  onResume: () => void;
  /** Duração da micro-pausa em segundos. Default: 120 (2 min). */
  durationSec?: number;
  /** Quantas perdas de foco dispararam a pausa (texto de apoio). */
  distractionCount?: number;
}

/**
 * MODO FOCO CONSCIENTE — micro-pausa de intervenção.
 *
 * Tema escuro obrigatório em azul-marinho/roxo profundo (saúde ocular
 * noturna), transições suaves de 300ms para não assustar, e exercício de
 * respiração em CSS puro (círculo que expande/contrai em ciclo de 8s).
 *
 * O botão "Retomar Estudo" só habilita quando o cronômetro de 2 minutos
 * termina: a pausa é um convite irrecusável ao descanso, não um pop-up
 * dispensável.
 */
export function ConsciousPauseOverlay({
  open,
  onResume,
  durationSec = CONSCIOUS_PAUSE_SECONDS,
  distractionCount = 3,
}: ConsciousPauseOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(open);

  // Monta com fade suave; desmonta 300ms após fechar (saída suave).
  useEffect(() => {
    if (open) {
      setElapsed(0);
      setVisible(true);
      return;
    }
    const id = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(id);
  }, [open]);

  // Cronômetro da micro-pausa.
  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= durationSec) {
          window.clearInterval(id);
          return durationSec;
        }
        return e + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, durationSec]);

  // Esc não fecha antes da hora: a pausa precisa ser cumprida.
  // (Sem trap de foco propositalmente — o fundo já está desfocado e
  // inerte enquanto o modal está aberto.)
  if (!visible) return null;

  const remaining = Math.max(0, durationSec - elapsed);
  const finished = remaining <= 0;
  const progress = durationSec > 0 ? Math.min(1, elapsed / durationSec) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pausa-consciente-titulo"
      aria-describedby="pausa-consciente-descricao"
      // Sem `items-center`: com ele, em telas baixas o topo do card é
      // cortado sem chance de rolagem. O `m-auto` do card centraliza
      // quando há espaço e rola corretamente quando não há.
      className={`fixed inset-0 z-[200] flex overflow-y-auto p-4 transition-all duration-300 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{
        background:
          'radial-gradient(1000px 600px at 50% 20%, rgba(76, 29, 149, 0.28), transparent 65%), radial-gradient(800px 500px at 50% 100%, rgba(30, 58, 138, 0.30), transparent 60%), rgba(4, 7, 18, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* Animação do exercício de respiração — CSS puro, ciclo de 8s
          (4s inspira expandindo, 4s expira contraindo). Respeita
          prefers-reduced-motion via media query. */}
      <style>{`
        @keyframes conscious-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(0.62); opacity: 0.55; }
          50% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes conscious-halo {
          0%, 100% { transform: translate(-50%, -50%) scale(0.55); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.25); opacity: 0.5; }
        }
        .conscious-breath {
          animation: conscious-breathe 8s ease-in-out infinite;
        }
        .conscious-halo {
          animation: conscious-halo 8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .conscious-breath, .conscious-halo { animation: none; }
        }
      `}</style>

      <div
        className={`relative m-auto w-full max-w-md rounded-3xl border border-indigo-400/15 bg-gradient-to-b from-[#141B33]/95 to-[#1B1140]/95 p-6 text-center shadow-[0_24px_80px_-12px_rgba(76,29,149,0.55)] backdrop-blur-xl transition-all duration-300 sm:p-8 ${
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
          Modo foco consciente
        </p>
        <h2 id="pausa-consciente-titulo" className="mt-2 text-xl font-bold text-slate-50 sm:text-2xl">
          Pausa para respirar
        </h2>

        <p
          id="pausa-consciente-descricao"
          className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-300/90"
        >
          Percebemos {distractionCount} idas e vindas em poucos minutos, e está tudo bem.
          Sua mente não está falhando, ela só está cansada. A cobrança pode esperar:
          por 2 minutinhos, a única tarefa é respirar. Sem culpa, sem pressa.
        </p>

        {/* Exercício visual de respiração.
            As classes -translate-* são o fallback de centralização quando
            `prefers-reduced-motion` desliga a animação (que carrega o
            translate no keyframe). Durante a animação, o keyframe vence. */}
        <div className="relative mx-auto mt-6 h-52 w-52 sm:h-60 sm:w-60" aria-hidden="true">
          <div className="conscious-halo absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/30" />
          <div
            className="conscious-breath absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-44 sm:w-44"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, rgba(129, 140, 248, 0.55), rgba(76, 29, 149, 0.45) 55%, rgba(15, 23, 42, 0.6))',
              boxShadow:
                '0 0 60px 8px rgba(99, 102, 241, 0.25), inset 0 0 30px rgba(167, 139, 250, 0.25)',
            }}
          />
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
            <span className="text-3xl font-extrabold tabular-nums text-white">
              {formatFocusTime(remaining)}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-indigo-200/70">
              {finished ? 'concluído' : 'respire junto'}
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400" aria-live="polite">
          {finished
            ? 'Ciclo de respiração completo. Volte no seu ritmo.'
            : 'Acompanhe o círculo: cresce inspirando pelo nariz, encolhe soltando pela boca.'}
        </p>

        {/* Progresso da pausa */}
        <div
          className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={durationSec}
          aria-valuenow={elapsed}
          aria-label="Progresso da micro-pausa"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <button
          type="button"
          onClick={onResume}
          disabled={!finished}
          aria-disabled={!finished}
          title={finished ? 'Voltar aos estudos' : 'Disponível ao fim dos 2 minutos'}
          className={`mt-6 w-full rounded-2xl px-6 py-3.5 text-sm font-bold transition-all duration-300 ${
            finished
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_30px_-6px_rgba(124,58,237,0.6)] hover:brightness-110 active:scale-[0.99]'
              : 'cursor-not-allowed bg-white/5 text-slate-500'
          }`}
        >
          {finished ? 'Retomar Estudo' : `Respire… (${formatFocusTime(remaining)})`}
        </button>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Cuidar da mente também é estudar. O cronômetro de foco continua de onde parou.
        </p>
      </div>
    </div>
  );
}
