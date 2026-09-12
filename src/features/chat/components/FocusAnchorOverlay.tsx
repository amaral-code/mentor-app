import { useEffect, useState } from 'react';
import { BookOpen, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DURACAO_SEG = 25 * 60;

/**
 * Ancora de Foco (todos os turnos): Pomodoro de 25 min em tela escura.
 * So timer + Cancelar - o comando e guardar o celular e focar no caderno,
 * sem pontuacao, sem vigilancia e sem travar a saida.
 */
export function FocusAnchorOverlay({ open, onClose }: Props) {
  const [restam, setRestam] = useState(DURACAO_SEG);

  useEffect(() => {
    if (!open) return;
    setRestam(DURACAO_SEG);
    const t = window.setInterval(() => {
      setRestam((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open ]);

  if (!open) return null;

  const mm = String(Math.floor(restam / 60)).padStart(2, '0');
  const ss = String(restam % 60).padStart(2, '0');
  const progresso = 1 - restam / DURACAO_SEG;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pomodoro de 25 minutos"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
        <BookOpen size={24} />
      </span>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-300">
        Guarde o celular e foque no caderno. Eu fico aqui marcando o tempo.
      </p>
      <p className="mt-6 font-mono text-6xl font-black text-white tabular-nums" aria-live="off">
        {mm}:{ss}
      </p>
      <div
        className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={Math.round(progresso * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do pomodoro"
      >
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-1000"
          style={{ width: `${progresso * 100}%` }}
        />
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {restam > 0 ? 'Foco total até o fim do ciclo.' : 'Ciclo completo! Descanse 5 minutos.'}
      </p>
      <button
        onClick={onClose}
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-white/10 active:scale-95"
      >
        <X size={15} />
        Cancelar
      </button>
    </div>
  );
}
