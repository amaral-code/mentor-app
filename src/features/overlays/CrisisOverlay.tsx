import { useState, useEffect, useRef } from 'react';
import { Wind } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { playClick } from '../../shared/lib/sfx';

export function CrisisOverlay() {
  const showCrisisOverlay = useAppStore((s) => s.showCrisisOverlay);
  const setShowCrisisOverlay = useAppStore((s) => s.setShowCrisisOverlay);
  const [phase, setPhase] = useState<'inicio' | 'respirando' | 'melhor'>('inicio');
  const [breathPhase, setBreathPhase] = useState<'inspira' | 'segura' | 'expira'>('inspira');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (showCrisisOverlay) { setPhase('inicio'); setBreathPhase('inspira'); setTimeLeft(0); }
  }, [showCrisisOverlay]);

  function startBreathing() {
    setPhase('respirando');
    let cycle = 0;
    const totalCycles = 4;
    function runCycle() {
      if (cycle >= totalCycles) { setPhase('melhor'); return; }
      setBreathPhase('inspira'); setTimeLeft(4);
      timerRef.current = setTimeout(() => {
        setBreathPhase('segura'); setTimeLeft(7);
        timerRef.current = setTimeout(() => {
          setBreathPhase('expira'); setTimeLeft(8);
          timerRef.current = setTimeout(() => { cycle++; runCycle(); }, 8000);
        }, 7000);
      }, 4000);
    }
    runCycle();
  }

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  useEffect(() => {
    if (timeLeft > 0 && phase === 'respirando') {
      const interval = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
      return () => clearInterval(interval);
    }
  }, [timeLeft, phase]);

  if (!showCrisisOverlay) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xl">
      <div className="text-center max-w-sm px-8 animate-scale-in space-y-6">
        <div className="w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-amber-500/5 to-orange-600/5 border border-amber-500/20 flex items-center justify-center animate-breathe shadow-[0_0_60px_rgba(245,158,11,0.05)]">
          <span className="text-5xl">{phase === 'inicio' ? '' : phase === 'respirando' ? '' : ''}</span>
        </div>

        {phase === 'inicio' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Sobrecarga Detectada</h2>
              <p className="text-sm text-gray-400 leading-relaxed">Seu índice de estresse está alto. Que tal uma pausa?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { startBreathing(); playClick(); }} className="btn-primary w-full"><Wind size={16} className="inline-block align-[-0.15em] text-cyan-400" /> Respiração Guiada 4-7-8</button>
              <button onClick={() => { setShowCrisisOverlay(false); playClick(); }} className="btn-secondary w-full">Estou melhor agora</button>
            </div>
          </div>
        )}

        {phase === 'respirando' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                {breathPhase === 'inspira' && 'Inspire '}
                {breathPhase === 'segura' && 'Segure '}
                {breathPhase === 'expira' && 'Expire ‍'}
              </h2>
              <p className="text-6xl font-extrabold text-amber-400 tabular-nums animate-pulse-subtle">{timeLeft}</p>
              <p className="text-xs text-gray-600">Siga o ritmo da respiração</p>
            </div>
            <div className="w-16 h-1 mx-auto rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500/50 xp-bar" style={{ width: `${((4 - timeLeft) / 4) * 100}%` }} />
            </div>
          </div>
        )}

        {phase === 'melhor' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Como está agora?</h2>
              <p className="text-sm text-gray-400 leading-relaxed">Espero que esteja se sentindo melhor. Respire fundo sempre que precisar.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowCrisisOverlay(false); playClick(); }} className="btn-primary w-full">Sim, estou melhor </button>
              <button onClick={startBreathing} className="btn-secondary w-full">Repetir respiração</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
