import { useState, useEffect, useRef } from 'react';
import { BarChart3, Timer } from 'lucide-react';
import { useAppStore, persistir } from '../../stores/appStore';
import { MeditationOverlay } from '../../shared/ui/MeditationOverlay';
import { EmptyState } from '../../shared/ui/EmptyState';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';

type FocoState = 'idle' | 'foco' | 'pausa' | 'concluido';
const FOCO_MIN = 25;
const PAUSA_MIN = 5;

export function FocoPage() {
  const { addXP, addLog, isMuted, setToast, cansaco } = useAppStore();
  const [state, setState] = useState<FocoState>('idle');
  const [segundos, setSegundos] = useState(FOCO_MIN * 60);
  const [cicles, setCicles] = useState(0);
  const [historico, setHistorico] = useState<{ tipo: string; minutos: number; data: string }[]>([]);
  const [sessoesHoje, setSessoesHoje] = useState(0);
  const [meditando, setMeditando] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;

  useEffect(() => {
    // Historico vem do banco (tabela sessoes_foco).
    supabaseRepository
      .loadSessoesFoco()
      .then((s) => {
        setHistorico(s);
        const hoje = new Date().toDateString();
        setSessoesHoje(
          s.filter(e => new Date(e.data).toDateString() === hoje && e.tipo === 'foco').length,
        );
      })
      // Silencio proposital: e o historico de foco na abertura da tela. Um
      // aviso de erro toda vez que a rede oscila atrapalharia mais do que
      // a lista vazia, e o cronometro funciona sem esse dado.
      .catch(() => {});
  }, []);

  function playAlerta() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      // Sem close, cada ciclo vazava um AudioContext na sessão.
      osc.onended = () => { void ctx.close().catch(() => {}); };
    } catch {}
  }

  function iniciar() {
    setState('foco');
    setSegundos(FOCO_MIN * 60);
  }

  /* Tick: intervalo único por ciclo (deps [state]). Antes `segundos` estava
     nas deps e o setInterval era destruído/recriado a cada tick (drift). */
  useEffect(() => {
    if (state !== 'foco' && state !== 'pausa') return;
    intervalRef.current = setInterval(() => {
      setSegundos(prev => {
        if (prev <= 1) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          if (!mutedRef.current) playAlerta();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [state]);

  /* Conclusão do ciclo: efeito separado reagindo a `segundos === 0`.
     O crédito acontece uma vez (o setState('concluido') desarma a guarda). */
  useEffect(() => {
    if (segundos !== 0 || (state !== 'foco' && state !== 'pausa')) return;
    if (state === 'foco') {
      const xp = 10 * (1 + cicles);
      addXP(xp);
      addLog({ timestamp: Date.now(), type: 'foco', description: `Ciclo de foco completo (${FOCO_MIN}min)`, xp });
      const entry = { tipo: 'foco', minutos: FOCO_MIN, data: new Date().toISOString() };
      setHistorico(h => [...h, entry]);
      // O XP ja foi creditado por addLog (que grava no servidor). Aqui
      // grava-se o HISTORICO da sessao; se falhar, o ciclo some do
      // historico de foco sem o aluno perceber que perdeu o registro.
      persistir(supabaseRepository.saveSessaoFoco('foco', FOCO_MIN), {
        aoFalhar: () => setHistorico(h => h.filter(x => x !== entry)),
        mensagem: 'O ciclo valeu XP, mas nao entrou no seu historico de foco.',
      });
      setCicles(p => p + 1);
      setToast(`+${xp} XP por ciclo de foco!`, 'success');
      setSessoesHoje(p => p + 1);
      setState('concluido');
    } else {
      setState('concluido');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, state]);

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const seg = s % 60;
    return `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }

  const totalMin = state === 'foco' || (state === 'concluido' && cicles > 0) ? FOCO_MIN : state === 'pausa' ? PAUSA_MIN : FOCO_MIN;
  const progresso = state === 'idle' ? 0 : ((totalMin * 60 - segundos) / (totalMin * 60)) * 100;

  // Stats
  const totalFocoMin = historico.filter(h => h.tipo === 'foco').reduce((acc, h) => acc + h.minutos, 0);
  const totalSessoes = historico.filter(h => h.tipo === 'foco').length;

  return (
    <div className="space-y-5 animate-fade-up max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 flex items-center justify-center">
          <Timer size={20} className="text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-white">Foco Total</h1>
          <p className="text-sm text-gray-500 mt-0.5">Timer Pomodoro para estudos</p>
        </div>
        {cansaco >= 4 && (
          <button
            onClick={() => setMeditando(true)}
            className="btn-secondary !px-4 !py-3 min-h-[44px] text-sm border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10"
            title="Você parece cansado - respire um pouco antes de continuar"
          > Meditar
          </button>
        )}
      </div>

      {/* Timer card */}
      <div className="glass rounded-2xl p-8 text-center">
        {/* Progress ring */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-48 h-48 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={state === 'foco' || state === 'concluido' ? '#10b981' : state === 'pausa' ? '#f59e0b' : '#475569'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(progresso / 100) * 326.7} 326.7`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-extrabold tabular-nums text-white tracking-tight">
              {formatTime(segundos)}
            </span>
            <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
              {state === 'idle' && 'Pronto'}
              {state === 'foco' && 'Foco'}
              {state === 'pausa' && 'Pausa'}
              {state === 'concluido' && 'Completo! '}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {state === 'idle' ? (
            <button onClick={iniciar} className="btn-primary px-8 py-3 text-base">
              ▶ Iniciar Foco
            </button>
          ) : state !== 'concluido' ? (
            <div className="flex gap-3">
              <button
                onClick={() => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } setState('concluido'); }}
                className="btn-ghost text-sm text-gray-400 hover:text-red-400"
              > Parar
              </button>
              {state === 'pausa' ? (
                <button onClick={() => { setState('foco'); setSegundos(FOCO_MIN * 60); }} className="btn-primary px-6">
                  ▶ Novo Foco
                </button>
              ) : (
                <button onClick={() => { setState('pausa'); setSegundos(PAUSA_MIN * 60); }} className="btn-secondary px-6">
                  ⏸ Pausa
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => { setState('foco'); setSegundos(FOCO_MIN * 60); }} className="btn-primary px-6">
                ▶ Próximo Ciclo
              </button>
              <button onClick={() => { setState('idle'); setSegundos(FOCO_MIN * 60); }} className="btn-secondary px-4 text-sm"> Reset
              </button>
            </div>
          )}
        </div>

        {/* Cycle info */}
        <div className="flex items-center justify-center gap-4 mt-5 text-xs text-gray-500">
          <span>{FOCO_MIN}min foco</span>
          <span className="w-1 h-1 rounded-full bg-gray-600" />
          <span>{PAUSA_MIN}min pausa</span>
          <span className="w-1 h-1 rounded-full bg-gray-600" />
          <span>{cicles} ciclos hoje</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass rounded-xl px-4 py-3 text-center">
          <p className="text-lg font-bold text-white tabular-nums">{sessoesHoje}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Sessões hoje</p>
        </div>
        <div className="glass rounded-xl px-4 py-3 text-center">
          <p className="text-lg font-bold text-white tabular-nums">{totalSessoes}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Total sessões</p>
        </div>
        <div className="glass rounded-xl px-4 py-3 text-center">
          <p className="text-lg font-bold text-white tabular-nums">{Math.round(totalFocoMin)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Min focados</p>
        </div>
      </div>

      {/* Recent history */}
      {historico.filter(h => h.tipo === 'foco').length === 0 && (
        <div className="glass rounded-2xl p-5">
          <EmptyState
            pose="meditando"
            compacto
            titulo="Nenhum ciclo de foco ainda"
            descricao="Comece um bloco de 25 minutos. O sagui fica de olho no relógio por você."
          />
        </div>
      )}

      {historico.filter(h => h.tipo === 'foco').length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3"><BarChart3 size={16} className="inline-block align-[-0.15em] text-cyan-400" /> Últimas sessões</h2>
          <div className="space-y-1.5">
            {historico.filter(h => h.tipo === 'foco').reverse().slice(0, 7).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 px-3 rounded-xl hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">●</span>
                  <span className="text-gray-400">{new Date(h.data).toLocaleDateString()}</span>
                </div>
                <span className="text-gray-500 text-xs tabular-nums">{h.minutos}min • {new Date(h.data).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dica */}
      <div className="text-center text-xs text-gray-600 leading-relaxed px-4 py-3 glass-light rounded-xl"> O ciclo Pomodoro ajuda a manter o foco e prevenir o cansaço mental. Complete ciclos para ganhar XP extra!
      </div>

      {/* Meditação (respiro) */}
      <MeditationOverlay
        open={meditando}
        onClose={() => setMeditando(false)}
        onComplete={(seconds) => {
          setMeditando(false);
          const xp = Math.max(5, Math.round(seconds / 20));
          addXP(xp);
          addLog({ timestamp: Date.now(), type: 'foco', description: `Meditação guiada (${Math.round(seconds)}s)`, xp });
          setToast(`+${xp} XP - mente renovada! `, 'success');
        }}
      />
    </div>
  );
}
