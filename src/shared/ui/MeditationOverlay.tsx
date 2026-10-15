import { useEffect, useMemo, useRef, useState } from 'react';
import { Mascot } from './Mascot';

const PHASES = ['INSPIRA', 'SEGURA', 'EXPIRA', 'SEGURA'] as const;
const PHASE_MS = [4000, 1500, 4000, 1500];
const CYCLE_MS = PHASE_MS.reduce((a, b) => a + b, 0);
const DEFAULT_DURATION = 120;

interface MeditationOverlayProps {
  open: boolean;
  onClose: () => void;
  onComplete: (seconds: number) => void;
  durationSec?: number;
}

function usePhase(totalSec: number, running: boolean) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    setMs(0);
    const id = setInterval(() => setMs((p) => p + 100), 100);
    return () => clearInterval(id);
  }, [running, totalSec]);

  const cyclePos = ms % CYCLE_MS;
  let acc = 0;
  let phase = 0;
  for (let i = 0; i < PHASE_MS.length; i++) {
    acc += PHASE_MS[i];
    if (cyclePos < acc) { phase = i; break; }
  }
  const inCycle = phase === 0 || phase === 2;
  const progress = Math.min(ms / (totalSec * 1000), 1);
  return { phase, progress, inCycle };
}

export function MeditationOverlay({ open, onClose, onComplete, durationSec = DEFAULT_DURATION }: MeditationOverlayProps) {
  const [running, setRunning] = useState(false);
  const completedRef = useRef(false);

  const { phase, progress } = usePhase(durationSec, running && open);
  const remaining = Math.max(0, Math.ceil(durationSec * (1 - progress)));
  const scale = phase === 0 ? 1 : phase === 2 ? 0.55 : phase === 1 ? 1.12 : 0.6;

  const ringStyle = useMemo(
    () => ({
      transform: `translateX(-50%) scale(${scale})`,
      transition: `transform ${PHASE_MS[phase] / 1000}s cubic-bezier(0.45, 0, 0.55, 1)`,
    }),
    [scale, phase],
  );

  useEffect(() => {
    if (open) {
      setRunning(true);
      completedRef.current = false;
    } else {
      setRunning(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      setRunning(false);
      onComplete(durationSec);
    }
  }, [progress, open, durationSec, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden" style={{ background: 'rgba(16, 15, 13, 0.92)' }}>

      {/* Coluna esquerda: personagem lateral respirando */}
      <div className="relative flex flex-col items-center gap-6 px-6">
        <Mascot
          state="idle"
          breathing
          size={180}
          speech={false}
          message=""
        />
        <p className="text-xs text-emerald-300/80 font-semibold">Meditação guiada</p>
      </div>

      {/* Coluna direita: guia + círculo de respiração + timer */}
      <div className="relative flex flex-col items-center gap-8 px-6 text-center">
        {/* Círculo guia */}
        <div className="relative w-56 h-56">
          <div
            className="absolute left-1/2 top-0 w-full aspect-square rounded-full border-2 border-emerald-400/30"
            style={ringStyle}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-emerald-500/15 border border-emerald-400/20 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold tabular-nums text-white">{remaining}s</span>
            <span className="text-xs text-emerald-300/70 mt-1">{Math.round(progress * 100)}%</span>
          </div>
        </div>

        {/* Fase atual */}
        <div className="flex items-center justify-center gap-3">
          {PHASES.map((p, i) => (
            <span
              key={p}
              className={`mm-breath-phase text-xs md:text-sm font-bold px-3 py-1.5 rounded-full ${
                i === phase ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-400/30' : 'text-gray-600 border border-white/5'
              }`}
            >
              {p === 'INSPIRA' ? ' Inspira' : p === 'EXPIRA' ? ' Expira' : p}
            </span>
          ))}
        </div>

        {/* Barra de progresso da sessão */}
        <div className="w-64 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <p className="text-xs text-gray-500 max-w-xs leading-relaxed"> Inspire pelo nariz em 4s, segure, e expire pela boca em 4s.
          Deixe o sagui te guiar no ritmo da respiração. 
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost text-xs text-gray-400 hover:text-gray-200"> Sair
          </button>
          <button
            onClick={() => { completedRef.current = true; onComplete(remaining); }}
            className="btn-primary px-6"
          > Concluir 
          </button>
        </div>
      </div>

    </div>
  );
}
