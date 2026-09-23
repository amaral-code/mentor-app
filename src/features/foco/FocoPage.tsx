import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { BarChart3, Hand, ShieldAlert, Timer } from 'lucide-react';
import { useAppStore, persistir } from '../../stores/appStore';
import { MeditationOverlay } from '../../shared/ui/MeditationOverlay';
import { EmptyState } from '../../shared/ui/EmptyState';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { focusMetricsRepository, type FocusMetricRow } from '../../shared/storage/FocusMetricsRepository';
import { useFocusTracker } from './useFocusTracker';
import { ConsciousPauseOverlay } from './ConsciousPauseOverlay';
import { distractionStage, formatFocusTime } from './focusLogic';

type FocoState = 'idle' | 'foco' | 'pausa' | 'concluido';
const FOCO_MIN = 25;
const PAUSA_MIN = 5;

/* ====================================================================
   Trechos memorizados da pagina.
   ====================================================================
   O cronometro faz setState 1x por segundo (mais o rastreador de atencao
   logo abaixo). Sem memo, cada tick recriava stats + listas de historico
   e re-diffava tudo no DOM. Estes blocos so mudam quando os dados mudam
   (fim de ciclo, carga do banco) — o tick do relogio os pula.
   ==================================================================== */
const FocoStats = memo(function FocoStats({
  sessoesHoje, totalSessoes, totalFocoMin,
}: {
  sessoesHoje: number;
  totalSessoes: number;
  totalFocoMin: number;
}) {
  return (
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
  );
});

const FocoHistorico = memo(function FocoHistorico({
  historico, metricasAtencao,
}: {
  historico: { tipo: string; minutos: number; data: string }[];
  metricasAtencao: FocusMetricRow[];
}) {
  const sessoes = historico.filter((h) => h.tipo === 'foco');
  return (
    <>
      {sessoes.length === 0 && (
        <div className="glass rounded-2xl p-5">
          <EmptyState
            pose="meditando"
            compacto
            titulo="Nenhum ciclo de foco ainda"
            descricao="Comece um bloco de 25 minutos. O sagui fica de olho no relógio por você."
          />
        </div>
      )}

      {metricasAtencao.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            <BarChart3 size={16} className="inline-block align-[-0.15em] text-violet-400" /> Atenção recente
          </h2>
          <div className="space-y-1.5">
            {metricasAtencao.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-2 px-3 rounded-xl hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-violet-400">●</span>
                  <span className="text-gray-400">
                    {new Date(`${m.sessionDate}T12:00:00`).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-gray-500 text-xs tabular-nums">
                  {m.focusedMinutes}min focados • {m.distractionCount} {m.distractionCount === 1 ? 'distração' : 'distrações'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessoes.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3"><BarChart3 size={16} className="inline-block align-[-0.15em] text-cyan-400" /> Últimas sessões</h2>
          <div className="space-y-1.5">
            {[...sessoes].reverse().slice(0, 7).map((h, i) => (
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
    </>
  );
});

/* ====================================================================
   MODO FOCO ESTRITO — modal bloqueador "Foco Interrompido".
   ====================================================================
   Estado 100% local e memorizado: o progresso do hold (atualizado a cada
   50ms) nunca sobe para a pagina — so o onDesbloquear estavel atravessa.
   ==================================================================== */
const HOLD_MS = 3000;

const TravaFocoModal = memo(function TravaFocoModal({
  aberto,
  restantes,
  onDesbloquear,
}: {
  aberto: boolean;
  /** Tempo preservado no cronometro (ex.: "17:42"). */
  restantes: string;
  onDesbloquear: () => void;
}) {
  const [progresso, setProgresso] = useState(0);
  const inicioRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const desbloquearRef = useRef(onDesbloquear);
  desbloquearRef.current = onDesbloquear;

  function pararHold() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    inicioRef.current = null;
    setProgresso(0);
  }

  // Reabriu: garante barra zerada. Desmontou no meio do hold: limpa.
  useEffect(() => {
    if (aberto) setProgresso(0);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [aberto ]);

  function iniciarHold() {
    if (inicioRef.current !== null) return;
    inicioRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const inicio = inicioRef.current;
      if (inicio === null) return;
      const decorrido = Date.now() - inicio;
      if (decorrido >= HOLD_MS) {
        pararHold();
        desbloquearRef.current();
        return;
      }
      setProgresso(Math.round((decorrido / HOLD_MS) * 100));
    }, 50);
  }

  if (!aberto) return null;

  const faltam = Math.max(1, Math.ceil(HOLD_MS * (1 - progresso / 100) / 1000));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foco interrompido"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6"
    >
      <div className="w-full max-w-sm rounded-3xl border border-red-500/25 bg-[#0e1628] p-6 text-center shadow-glass-lg animate-scale-in">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
          <ShieldAlert size={24} />
        </span>
        <h2 className="mt-3 text-lg font-bold text-white">Foco Interrompido</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Você saiu do app e o cronômetro <strong className="text-white">pausou em {restantes}</strong>.
          nenhum segundo foi perdido. O Modo Aula exige atenção exclusiva.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Respire fundo e segure o botão por 3 segundos para voltar a estudar.
        </p>

        <button
          type="button"
          onPointerDown={iniciarHold}
          onPointerUp={pararHold}
          onPointerLeave={pararHold}
          onPointerCancel={pararHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Segure por 3 segundos para voltar ao foco. Faltam ${faltam} segundos.`}
          className="relative mt-6 h-14 w-full select-none touch-none overflow-hidden rounded-2xl border border-amber-500/40 bg-white/[0.04] text-sm font-bold text-white active:scale-[0.99] transition-transform"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/50 to-orange-500/50"
            style={{ width: `${progresso}%` }}
          />
          <span className="relative flex items-center justify-center gap-2">
            <Hand size={17} className="text-amber-300" />
            {progresso > 0 ? `Segurando… ${faltam}s` : 'Segure 3s para voltar ao foco'}
          </span>
        </button>
      </div>
    </div>
  );
});

export function FocoPage() {
  // Seletores atomicos: o store inteiro aqui faria cada tick do relogio
  // (1/s) + cada toast/XP de OUTRA tela re-renderizar a pagina de foco.
  const addXP = useAppStore((s) => s.addXP);
  const addLog = useAppStore((s) => s.addLog);
  const isMuted = useAppStore((s) => s.isMuted);
  const setToast = useAppStore((s) => s.setToast);
  const cansaco = useAppStore((s) => s.cansaco);
  const [state, setState] = useState<FocoState>('idle');
  const [segundos, setSegundos] = useState(FOCO_MIN * 60);
  const [cicles, setCicles] = useState(0);
  const [historico, setHistorico] = useState<{ tipo: string; minutos: number; data: string }[]>([]);
  const [sessoesHoje, setSessoesHoje] = useState(0);
  const [meditando, setMeditando] = useState(false);
  // MODO FOCO ESTRITO: trava anti-distracao. Quando o cronometro de foco
  // esta rodando e o app e minimizado/trocado, o tick para na hora e a
  // tela bloqueia ate o hold de 3s — o tempo e preservado, nunca zerado.
  const [travado, setTravado] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;

  /*
   * MODO FOCO CONSCIENTE: rastreia perdas de atenção via `visibilitychange`
   * enquanto a página está montada. A intervenção é progressiva — toast
   * sutil na 1ª perda, aviso na 2ª, overlay de respiração na 3ª — e, ao
   * encerrar a sessão, as métricas vão para `focus_metrics` automaticamente.
   */
  const tracker = useFocusTracker({
    onDistraction: (n) => {
      const estagio = distractionStage(n);
      if (estagio === 'aviso-leve') {
        setToast('Uma ida e volta, sem culpa. Volte no seu ritmo.', 'info');
      } else if (estagio === 'aviso-final') {
        setToast('Segunda distração em poucos minutos. Na próxima, faremos uma pausa para respirar juntos.', 'info');
      }
    },
  });
  const pausaAberta = tracker.shouldPause;
  const [metricasAtencao, setMetricasAtencao] = useState<FocusMetricRow[]>([]);

  /** Persiste as métricas da sessão atual em `focus_metrics`. */
  function salvarMetricasFoco() {
    const metrics = tracker.stop();
    // Sessão sem 1 min de foco nem distração: ruído, não vale a linha.
    if (metrics.focusedMinutes <= 0 && metrics.distractionCount <= 0) return;
    persistir(
      focusMetricsRepository.salvarMetricasSessao(metrics).then((row) => {
        // Confirmação do servidor: entra no histórico da tela na hora.
        if (row) setMetricasAtencao((m) => [row, ...m].slice(0, 7));
        return row;
      }),
      {
        mensagem: 'Não foi possível salvar as métricas de foco desta sessão.',
      },
    );
    tracker.reset();
  }

  /*
   * Sair da aba Foco também encerra a sessão (a página desmonta): salva o
   * acumulado no unmount. Após Parar/ciclo completo os refs já foram
   * zerados pelo reset e o filtro de ruído descarta — sem duplicar linha.
   * Seguro no StrictMode: na remontagem de dev os refs estão zerados.
   */
  const salvarRef = useRef(salvarMetricasFoco);
  salvarRef.current = salvarMetricasFoco;
  useEffect(() => {
    return () => { salvarRef.current(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Métricas de atenção (focus_metrics): mesmo silêncio proposital.
    focusMetricsRepository.listarMetricas(7).then(setMetricasAtencao).catch(() => {});
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
    setTravado(false);
    setState('foco');
    setSegundos(FOCO_MIN * 60);
  }

  /*
   * Trava anti-distracao (Page Visibility API).
   *
   * Regra: cronometro de FOCO rodando + app oculto (minimizar, trocar de
   * aba, bloquear a tela) = pausa imediata + modal bloqueador na volta.
   * Vale so para 'foco': na 'pausa' o descanso e livre, sem vigilancia.
   * O estado e lido via ref para o listener ser registrado uma unica vez
   * (sem re-subscrever a cada tick) e a limpeza e no unmount.
   */
  useEffect(() => {
    const aoMudarVisibilidade = () => {
      if (document.hidden && stateRef.current === 'foco') {
        setTravado(true);
      }
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, []);

  // Estavel: o modal memorizado so re-renderiza no abrir/fechar.
  const desbloquear = useCallback(() => setTravado(false), []);

  /* Tick: intervalo único por ciclo (deps [state, travado]). Antes
     `segundos` estava nas deps e o setInterval era destruído/recriado a
     cada tick (drift). Travado = sem intervalo: o tempo congela onde
     estava, sem decrementar escondido. */
  useEffect(() => {
    if (travado || (state !== 'foco' && state !== 'pausa')) return;
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
  }, [state, travado]);

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
      // Sessão encerrada (ciclo completo): métricas vão para focus_metrics.
      salvarMetricasFoco();
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

  // Estavel entre ticks: o overlay e recriado a cada segundo se receber
  // closure nova (mesmo fechado, a reconciliacao passa por ele).
  const aoCompletarMeditacao = useCallback((seconds: number) => {
    setMeditando(false);
    const xp = Math.max(5, Math.round(seconds / 20));
    addXP(xp);
    addLog({ timestamp: Date.now(), type: 'foco', description: `Meditação guiada (${Math.round(seconds)}s)`, xp });
    setToast(`+${xp} XP, mente renovada! `, 'success');
  }, [addXP, addLog, setToast]);

  return (
    <>
    {/* Desfoque suave do conteúdo principal enquanto a micro-pausa ou a
        trava estrita estão abertas. */}
    <div className={`space-y-5 animate-fade-up max-w-lg mx-auto transition-all duration-300 ${(pausaAberta || travado) ? 'pointer-events-none select-none blur-sm' : ''}`}>
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
            title="Você parece cansado. Respire um pouco antes de continuar"
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
                onClick={() => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } salvarMetricasFoco(); setTravado(false); setState('concluido'); }}
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

        {/* Modo Foco Consciente: tempo de atenção + perdas de foco ao vivo. */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs" aria-live="polite">
          <span className="text-indigo-300/90 tabular-nums" title="Tempo de foco contínuo (aba visível)">
            Foco {formatFocusTime(tracker.focusSeconds)}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-600" />
          <span className={tracker.distractionCount > 0 ? 'text-violet-300/90' : 'text-gray-500'} title="Mudanças de aba nesta sessão">
            {tracker.distractionCount} {tracker.distractionCount === 1 ? 'distração' : 'distrações'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <FocoStats sessoesHoje={sessoesHoje} totalSessoes={totalSessoes} totalFocoMin={totalFocoMin} />

      {/* Historico + atencao (memorizados: pulam o tick de 1s) */}
      <FocoHistorico historico={historico} metricasAtencao={metricasAtencao} />

      {/* Dica */}
      <div className="text-center text-xs text-gray-600 leading-relaxed px-4 py-3 glass-light rounded-xl"> O ciclo Pomodoro ajuda a manter o foco e prevenir o cansaço mental. Complete ciclos para ganhar XP extra!
      </div>

      {/* Meditação (respiro) */}
      <MeditationOverlay
        open={meditando}
        onClose={() => setMeditando(false)}
        onComplete={aoCompletarMeditacao}
      />
    </div>

    {/* Micro-pausa consciente: 3 distrações em 15 min disparam o modal. */}
    <ConsciousPauseOverlay
      open={pausaAberta}
      distractionCount={tracker.distractionCount}
      onResume={tracker.dismissPause}
    />

    {/* Modo Foco Estrito: saiu do app com o cronometro rodando = tela
        bloqueada ate o hold de 3s. O tempo foi preservado. */}
    <TravaFocoModal
      aberto={travado}
      restantes={formatTime(segundos)}
      onDesbloquear={desbloquear}
    />
    </>
  );
}
