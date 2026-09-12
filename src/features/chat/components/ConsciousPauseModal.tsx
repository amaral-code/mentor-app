import { useEffect, useState } from 'react';
import { Wind } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DURACAO_SEG = 60;

/**
 * EPICO 2: pausa consciente anti-vigilancia.
 *
 * Renderizado por cima do chat (blur no fundo) quando a flag
 * `frustration_detected` chega. Animacao de respiracao de 60s, mensagem
 * de acolhimento, e dispensa a qualquer momento: nada aqui bloqueia a
 * tela de forma autoritaria nem impede o estudo.
 */
export function ConsciousPauseModal({ open, onClose }: Props) {
  const [restam, setRestam] = useState(DURACAO_SEG);

  useEffect(() => {
    if (!open) return;
    setRestam(DURACAO_SEG);
    const t = window.setInterval(() => {
      setRestam((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [open, onClose]);

  if (!open) return null;

  const progresso = 1 - restam / DURACAO_SEG;
  const mm = `${Math.floor(restam / 60)}:${String(restam % 60).padStart(2, '0')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pausa consciente de 1 minuto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-950/70 p-4 backdrop-blur-md"
    >
      <style>{`@keyframes pausa-respiracao { 0%, 100% { transform: scale(1); opacity: 0.75; } 50% { transform: scale(1.45); opacity: 1; } }`}</style>
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-midnight-900/95 p-6 text-center shadow-glass-lg animate-scale-in">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
          <Wind size={20} />
        </span>
        <h2 className="mt-3 text-lg font-bold text-white">Pausa consciente</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Notei que essa parte está difícil. Vamos pausar 1 minuto e respirar. O erro faz parte do
          processo.
        </p>

        {/* Círculo de respiração: expande (inspire) / contrai (expire). */}
        <div className="my-6 flex items-center justify-center" aria-hidden="true">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/15 blur-xl" />
            <div
              className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-400/40 to-emerald-500/30"
              style={{ animation: 'pausa-respiracao 8s ease-in-out infinite' }}
            />
            <span className="relative font-mono text-2xl font-bold text-white tabular-nums">{mm}</span>
          </div>
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(progresso * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da pausa"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-1000"
            style={{ width: `${progresso * 100}%` }}
          />
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          {restam > 0 ? 'Respire junto com o círculo. Feche quando quiser.' : 'Ciclo completo. Volte no seu ritmo.'}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            autoFocus
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-midnight-950 transition-all hover:brightness-110 active:scale-95"
          >
            Voltar ao estudo
          </button>
          <button
            onClick={() => setRestam(DURACAO_SEG)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-white/10 active:scale-95"
          >
            +1 min
          </button>
        </div>
      </div>
    </div>
  );
}
