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
    /* z acima da Companhia de Foco (z-[80]), que ficava por cima deste aviso.
       O conteúdo vai num cartão BRANCO: na troca para o tema claro os
       textos viraram azul-noite e ficaram ilegíveis sobre o fundo escuro. */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pausa para respirar"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="text-center w-full max-w-sm px-6 py-8 animate-scale-in space-y-6 rounded-3xl bg-white border-2 border-slate-200 shadow-xl">
        <div className="w-24 h-24 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center animate-breathe">
          <Wind size={40} className="text-amber-600" aria-hidden="true" />
        </div>

        {phase === 'inicio' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-tinta-900">Sobrecarga Detectada</h2>
              <p className="text-sm text-slate-600 leading-relaxed">Seu índice de estresse está alto. Que tal uma pausa?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { startBreathing(); playClick(); }} className="btn-primary w-full"><Wind size={16} className="inline-block align-[-0.15em] text-cyan-700" /> Respiração Guiada 4-7-8</button>
              <button onClick={() => { setShowCrisisOverlay(false); playClick(); }} className="btn-secondary w-full">Estou melhor agora</button>
            </div>
            {/* Respirar ajuda no cansaço; não é resposta para quem está em
                sofrimento. O telefone fica à vista para esse caso. */}
            <p className="text-xs text-slate-600 leading-relaxed">
              Se o que você sente for mais do que cansaço, ligue para o CVV, no <strong className="text-tinta-900">188</strong>. É gratuito e funciona 24 horas.
            </p>
          </div>
        )}

        {phase === 'respirando' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-tinta-900">
                {breathPhase === 'inspira' && 'Inspire'}
                {breathPhase === 'segura' && 'Segure'}
                {breathPhase === 'expira' && 'Expire'}
              </h2>
              <p className="text-6xl font-extrabold text-amber-600 tabular-nums animate-pulse-subtle">{timeLeft}</p>
              <p className="text-xs text-slate-500">Siga o ritmo da respiração</p>
            </div>
            <div className="w-16 h-1 mx-auto rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500/50 xp-bar" style={{ width: `${((4 - timeLeft) / 4) * 100}%` }} />
            </div>
          </div>
        )}

        {phase === 'melhor' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-tinta-900">Como está agora?</h2>
              <p className="text-sm text-slate-600 leading-relaxed">Espero que esteja se sentindo melhor. Respire fundo sempre que precisar.</p>
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
