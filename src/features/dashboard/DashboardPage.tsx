import { useEffect, useMemo, useState, memo, useRef, useCallback } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { listContainer, listItem } from '../../shared/lib/motionPresets';
import { AnimatedNumber } from '../../shared/ui/AnimatedNumber';
import { BarChart3, BookOpen, Camera, Flame, Frown, Moon, Sparkles, Target, Timer, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { getSSCColor, getSSCLabel } from '../../shared/lib/sscCalculator';
import { MicroTask, QuizResult } from '../../shared/types';
import { calcLevel, getToday, MOOD_LABEL, MOOD_COLOR } from '../../shared/lib/utils';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { safeSet } from '../../shared/lib/safeStorage';
import { AppIcon, MoodIcon } from '../../shared/ui/AppIcon';
import { BurnoutCard } from './BurnoutCard';

/* ====================================================================
   COMPROVAÇÃO DE TAREFA — modal anti-clique-fácil.
   ====================================================================
   Clicar no checkbox NÃO conclui mais: abre este modal exigindo prova —
   foto (câmera/upload, só prévia local) OU parágrafo de 30+ caracteres
   contando o que aprendeu. Estado 100% interno e memorizado: digitar o
   parágrafo não re-renderiza o Dashboard (o plano tem tick de XP e o
   checkbox não pode engasgar).
   A prova em texto é auditável no aparelho (mm_comprovacoes); a foto
   ainda não sobe ao servidor (exigiria migration do bucket) — por isso
   a prévia é descartada ao fechar, sem prometer o que não persiste.
   ==================================================================== */
const MIN_PARAGRAFO = 30;

const ComprovacaoModal = memo(function ComprovacaoModal({
  tarefa,
  onFechar,
  onConfirmar,
}: {
  tarefa: MicroTask;
  onFechar: () => void;
  onConfirmar: (prova: { texto: string; temFoto: boolean }) => void;
}) {
  const [texto, setTexto] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const fotoUrlRef = useRef<string | null>(null);

  function revogarFoto() {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
      fotoUrlRef.current = null;
    }
  }

  useEffect(() => revogarFoto, []);

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo || !arquivo.type.startsWith('image/')) return;
    revogarFoto();
    fotoUrlRef.current = URL.createObjectURL(arquivo);
    setFotoUrl(fotoUrlRef.current);
  }

  function fechar() {
    revogarFoto();
    setFotoUrl(null);
    onFechar();
  }

  const pronto = !!fotoUrl || texto.trim().length >= MIN_PARAGRAFO;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Comprovar tarefa">
      <button aria-label="Fechar" tabIndex={-1} onClick={fechar} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm glass rounded-2xl p-6 animate-fade-up max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <button onClick={fechar} aria-label="Fechar comprovação" className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-white">
          <X size={16} />
        </button>
        <p className="text-[11px] text-amber-400 uppercase tracking-widest font-semibold">Comprovação</p>
        <h2 className="text-base font-bold text-white mt-1 pr-8">{tarefa.titulo}</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Clicar não basta: mostre que fez. Envie uma <strong className="text-gray-300">foto</strong> ou
          escreva <strong className="text-gray-300">o que aprendeu</strong> (mín. {MIN_PARAGRAFO} letras).
        </p>

        <input ref={inputFoto} type="file" accept="image/*" capture="environment" onChange={aoEscolherFoto} className="hidden" aria-hidden="true" tabIndex={-1} />
        {fotoUrl ? (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 relative">
            <img src={fotoUrl} alt="Comprovação da tarefa" className="w-full h-auto max-h-48 object-cover" />
            <button onClick={() => { revogarFoto(); setFotoUrl(null); }} className="absolute top-2 right-2 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-black/60 text-gray-200">
              Trocar foto
            </button>
          </div>
        ) : (
          <button onClick={() => inputFoto.current?.click()} className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-white/15 text-sm text-gray-300 hover:border-amber-500/40 hover:text-white transition-all min-h-[52px]">
            <Camera size={16} /> Tirar foto / enviar imagem
          </button>
        )}

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: aprendi que razão é divisão entre grandezas e usei regra de três em 3 questões…"
          rows={3}
          aria-label="O que você aprendeu"
          className="mt-3"
        />
        <p className={`text-[11px] mt-1 tabular-nums ${texto.trim().length >= MIN_PARAGRAFO ? 'text-emerald-400' : 'text-gray-600'}`}>
          {texto.trim().length}/{MIN_PARAGRAFO} letras
        </p>

        <button
          onClick={() => { const t = texto.trim(); revogarFoto(); onConfirmar({ texto: t, temFoto: !!fotoUrl }); }}
          disabled={!pronto}
          className="btn-primary w-full h-12 mt-4 disabled:opacity-40"
        >
          Confirmar conclusão • +20 XP
        </button>
      </div>
    </div>
  );
});

export function DashboardPage() {
  const reduzir = useReducedMotion();
  const currentMood = useAppStore((s) => s.currentMood);
  const moodColor = useAppStore((s) => s.moodColor);
  const sscScore = useAppStore((s) => s.sscScore);
  const sono = useAppStore((s) => s.sono);
  const cansaco = useAppStore((s) => s.cansaco);
  const gamification = useAppStore((s) => s.gamification);
  const dailyPlan = useAppStore((s) => s.dailyPlan);
  const setSono = useAppStore((s) => s.setSono);
  const setCansaco = useAppStore((s) => s.setCansaco);
  const recalcSSC = useAppStore((s) => s.recalcSSC);
  const completeTask = useAppStore((s) => s.completeTask);
  const regeneratePlan = useAppStore((s) => s.regeneratePlan);
  const quizResults = useAppStore((s) => s.quizResults);
  const logs = useAppStore((s) => s.logs);
  const session = useAppStore((s) => s.session);

  /** Id da tarefa que acabou de ganhar XP: posiciona o "+20 XP" flutuante. */
  const [xpVoando, setXpVoando] = useState<string | null>(null);
  /** Tarefa aguardando comprovação no modal (null = modal fechado). */
  const [tarefaAlvo, setTarefaAlvo] = useState<MicroTask | null>(null);

  // Checkbox abre o modal de comprovação; SÓ o confirmar do modal chama
  // completeTask. Sem prova, sem XP — fim do "cliquei, ganhei".
  const pedirComprovacao = useCallback((task: MicroTask) => {
    if (!task.completed) setTarefaAlvo(task);
  }, []);

  const confirmarComprovacao = useCallback((taskId: string, prova: { texto: string; temFoto: boolean }) => {
    // Auditoria local: o que valeu o XP fica registrado no aparelho.
    try {
      const bruto = localStorage.getItem('mm_comprovacoes');
      const lista = bruto ? JSON.parse(bruto) : [];
      lista.push({ taskId, data: getToday(), ...prova, em: Date.now() });
      safeSet('mm_comprovacoes', JSON.stringify(lista.slice(-60)));
    } catch { /* aparelho sem storage: o XP segue valendo */ }
    setTarefaAlvo(null);
    completeTask(taskId);
    setXpVoando(taskId);
    window.setTimeout(() => setXpVoando(null), 1000);
  }, [completeTask]);

  useEffect(() => {
    recalcSSC();
    // Plano de hoje vem do banco; so gera um novo se nao existir.
    supabaseRepository
      .loadPlano(getToday())
      .then((plan) => {
        if (plan) useAppStore.setState({ dailyPlan: plan });
        else regeneratePlan();
      })
      .catch(() => regeneratePlan());
  }, []);

  /* Nível e progresso SEMPRE via calcLevel (fonte única): o campo level do
     servidor pode vir da fórmula plana antiga de quem não rodou a 008. */
  const { level: nivel, remainder: xpProgress } = calcLevel(gamification.xp);
  const xpForNext = 100 * nivel;
  const sscLevel = getSSCLabel(sscScore);
  const sscColor = getSSCColor(sscScore);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sparkles size={22} className="text-gray-900" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Central de Comando</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bem-vindo, {session?.nome?.split(' ')[0] || 'Estudante'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all ${
          gamification.streak >= 3 ? 'bg-amber-500/10 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.05)]' : 'bg-white/5 text-gray-400'
        }`}>
          {/* Mesma linguagem do top bar mobile: a partir de 3 dias a chama
              acende e ganha movimento. Antes eram duas animacoes diferentes
              para o mesmo dado. */}
          <Flame
            size={16}
            className={gamification.streak >= 3 ? 'text-amber-400 motion-safe:animate-flame' : 'text-gray-400'}
            fill={gamification.streak >= 3 ? 'currentColor' : 'none'}
          />
          <AnimatedNumber value={gamification.streak} className="font-bold" />
          <span className="text-xs opacity-60">dias</span>
        </div>
      </div>

      <m.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={reduzir ? undefined : listContainer}
        initial={reduzir ? false : 'inicial'}
        animate={reduzir ? undefined : 'animar'}
      >
        <m.div variants={reduzir ? undefined : listItem} className="glass rounded-2xl p-5 group hover:border-white/[0.08] transition-all lift">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse-subtle" style={{ backgroundColor: moodColor, boxShadow: `0 0 12px ${moodColor}40` }} />
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Humor</span>
          </div>
          <div className="flex items-center gap-3">
            <MoodIcon mood={currentMood} size={30} />
            <div>
              <p className="text-xl font-bold text-white">{MOOD_LABEL[currentMood] || 'Tranquilo'}</p>
              <p className="text-xs text-gray-500">Baseado nas conversas</p>
            </div>
          </div>

        </m.div>

        <m.div variants={reduzir ? undefined : listItem} className="glass rounded-2xl p-5 group hover:border-white/[0.08] transition-all lift">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Prontidão (SSC)</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full transition-all" style={{ backgroundColor: sscColor + '18', color: sscColor }}>
              {sscLevel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                <circle cx="20" cy="20" r="16" fill="none" stroke={sscColor} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(sscScore / 100) * 100.5} 100.5`} className="transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: sscColor }}>
                  <AnimatedNumber value={sscScore} sufixo="%" />
                </span>
              </div>
            </div>
            <div className="flex-1">
              {/* Cor do SSC e dinamica (verde a vermelho), entao vai por
                  style. O movimento continua sendo scaleX na GPU. */}
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <m.div
                  className="h-full w-full rounded-full origin-left"
                  style={{ backgroundColor: sscColor }}
                  initial={false}
                  animate={{ scaleX: Math.max(0, Math.min(100, sscScore)) / 100 }}
                  transition={reduzir ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
              {/* Os dois rotulos colavam quando a coluna encolhe (tablet).
                  gap + truncate garante folga em qualquer largura. */}
              <div className="flex justify-between gap-2 text-[10px] text-gray-600 mt-1">
                <span className="truncate">Descansado</span>
                <span className="truncate">Sobrecarga</span>
              </div>
            </div>
          </div>
        </m.div>

        <m.div variants={reduzir ? undefined : listItem} className="glass rounded-2xl p-5 group hover:border-white/[0.08] transition-all lift">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-3">Estado Físico</span>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg"><Moon size={16} className="inline-block align-[-0.15em] text-violet-400" /></span>
                <span className="text-sm text-gray-400">Sono</span>
              </div>
              <span className="text-sm font-medium text-white tabular-nums">{sono}h</span>
            </div>
            <input type="range" min="0" max="12" step="0.5" value={sono} onChange={e => { setSono(+e.target.value); recalcSSC(); }} className="w-full h-2 md:h-1.5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg"><Frown size={16} className="inline-block align-[-0.15em] text-orange-400" /></span>
                <span className="text-sm text-gray-400">Cansaço</span>
              </div>
              <span className="text-sm font-medium text-white tabular-nums">{cansaco}/10</span>
            </div>
            <input type="range" min="0" max="10" step="1" value={cansaco} onChange={e => { setCansaco(+e.target.value); recalcSSC(); }} className="w-full h-2 md:h-1.5" />
          </div>
        </m.div>
      </m.div>

      {/* Indice de fadiga: fica entre o estado fisico declarado (sono,
          cansaco) e o plano do dia, porque e ele que justifica um plano
          mais leve quando o modelo aponta risco. */}
      <BurnoutCard />

      <div className="glass rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Timer size={16} className="text-amber-400" /> Plano do Dia
            {currentMood && (
              <span className="hidden sm:inline text-xs text-gray-500 font-normal ml-1">
                <MoodIcon mood={currentMood} size={13} className="inline-block align-[-0.15em] mr-1" />
                {MOOD_LABEL[currentMood] || 'Neutro'}
              </span>
            )}
          </h2>
          <span className="text-xs text-gray-500 tabular-nums bg-white/[0.03] px-2.5 py-1 rounded-full">
            {dailyPlan?.tasks.filter(t => t.completed).length || 0}/{dailyPlan?.tasks.length || 0} concluídas
          </span>
        </div>
        {dailyPlan && dailyPlan.tasks.length > 0 ? (
          <m.div
            className="space-y-2"
            variants={reduzir ? undefined : listContainer}
            initial={reduzir ? false : 'inicial'}
            animate={reduzir ? undefined : 'animar'}
          >
            {dailyPlan.tasks.map(task => (
              <m.label
                variants={reduzir ? undefined : listItem}
                key={task.id}
                className={`relative flex items-start gap-3 p-3.5 rounded-xl transition-all duration-200 border ${
                  task.completed
                    ? 'bg-white/[0.02] border-white/5 cursor-default'
                    : 'cursor-pointer press hover:bg-white/[0.02] border-transparent hover:border-white/5'
                }`}>
                {/* Recompensa na hora: o XP sobe do proprio item concluido */}
                {xpVoando === task.id && (
                  <span className="pointer-events-none absolute right-4 top-3 text-sm font-bold text-amber-400 motion-safe:animate-fade-up-out">
                    +20 XP
                  </span>
                )}
                {/* Tarefa concluida nao volta atras: era exatamente o
                    ciclo marcar/desmarcar que dava XP infinito. */}
                {/* Checkbox é o gatilho do modal de comprovação, não a
                    conclusão em si: concluída, trava (anti-XP-infinito). */}
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={task.completed}
                  onChange={() => pedirComprovacao(task)}
                  aria-label={`Comprovar e concluir: ${task.titulo}`}
                  className="mt-0.5"
                />
                <div className={`flex-1 ${task.completed ? 'opacity-40' : ''}`}>
                  <span className={`text-sm font-medium ${task.completed ? 'text-gray-500 risco risco--feito' : 'text-white'}`}>
                    <AppIcon name={task.icon} size={15} className="inline-block mr-1.5 -mt-0.5 text-amber-400/80" />{task.titulo}
                  </span>
                  <p className={`text-xs mt-0.5 ${task.completed ? 'text-gray-600' : 'text-gray-500'}`}>{task.descricao}</p>
                </div>
                {!task.completed && (
                  <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">+20 XP</span>
                )}
              </m.label>
            ))}
          </m.div>
        ) : (
          <div className="text-center py-8 flex flex-col items-center">
            <img
              src="/assets/sagui_meditando_2.png"
              alt=""
              width={96}
              height={96}
              loading="lazy"
              className="w-24 h-24 object-contain mb-2 opacity-90 motion-safe:animate-float-suave"
            />
            <p className="text-sm text-gray-400">Diz como você está hoje.</p>
            <p className="text-xs text-gray-500 mt-0.5">O sagui monta o plano a partir daí.</p>
          </div>
        )}
      </div>

      {quizResults.length > 0 && <QuizPerformance quizResults={quizResults} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <BarChart3 size={14} /> Progresso
            </span>
            <span className="text-xs text-gray-500 tabular-nums">Nível {nivel}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold text-white tabular-nums">{xpProgress}</span>
            <span className="text-sm text-gray-500 tabular-nums">/ {xpForNext} XP</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 xp-bar" style={{ width: `${(xpProgress / xpForNext) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2 tabular-nums">{gamification.xp} XP acumulados</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-3 flex items-center gap-1.5">
            <Moon size={14} /> Biofeedback (24h)
          </span>
          <MoodMiniGraph />
        </div>

        <div className="glass rounded-2xl p-5">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-3 flex items-center gap-1.5">
            <BookOpen size={14} /> Atividades
          </span>
          <ActivitySummary logs={logs} />
        </div>
      </div>

      {/* Modal de comprovação: fora da lista, montado só com tarefa-alvo */}
      {tarefaAlvo && (
        <ComprovacaoModal
          tarefa={tarefaAlvo}
          onFechar={() => setTarefaAlvo(null)}
          onConfirmar={(prova) => confirmarComprovacao(tarefaAlvo.id, prova)}
        />
      )}
    </div>
  );
}

function QuizPerformance({ quizResults }: { quizResults: QuizResult[] }) {
  const perMateria = useMemo(() => {
    const map = new Map<string, { acertos: number; total: number; count: number }>();
    for (const r of quizResults) {
      const prev = map.get(r.materia) || { acertos: 0, total: 0, count: 0 };
      prev.acertos += r.acertos;
      prev.total += r.total;
      prev.count += 1;
      map.set(r.materia, prev);
    }
    return Array.from(map.entries())
      .map(([materia, data]) => ({ materia, ...data, pct: Math.round((data.acertos / data.total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [quizResults]);

  const media = Math.round(perMateria.reduce((acc, m) => acc + m.pct, 0) / perMateria.length);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Target size={16} className="text-amber-400" /> Desempenho nos Quizzes
        </h2>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
          media >= 70 ? 'bg-emerald-500/10 text-emerald-400' : media >= 40 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {media}% média
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {perMateria.map(m => (
          <div key={m.materia} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-all">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-300 truncate">{m.materia}</span>
                <span className="text-xs text-gray-500 tabular-nums ml-2 shrink-0">{m.acertos}/{m.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${m.pct}%`, backgroundColor: m.pct >= 70 ? '#10b981' : m.pct >= 40 ? '#f59e0b' : '#ef4444' }} />
              </div>
            </div>
            <span className={`text-xs font-bold tabular-nums w-10 text-right ${
              m.pct >= 70 ? 'text-emerald-400' : m.pct >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>{m.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitySummary({ logs }: { logs: { type: string; timestamp: number }[] }) {
  const hoje = useMemo(() => new Date().toDateString(), []);
  const semana = useMemo(() => {
    const dias: { label: string; active: boolean; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === dateStr);
      dias.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
        active: dayLogs.length > 0,
        count: dayLogs.length,
      });
    }
    return dias;
  }, [logs]);

  const totalHoje = useMemo(() => logs.filter(l => new Date(l.timestamp).toDateString() === hoje).length,
  [logs, hoje]);
  const totalSemana = logs.length;

  const hojeRef = useMemo(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }), []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1 capitalize">
        <span>{hojeRef}</span>
        <span className="text-white font-medium tabular-nums">{totalHoje} atividade{totalHoje !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-1.5 justify-center">
        {semana.map((dia, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`w-full aspect-square rounded-lg transition-all ${
              dia.active ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)]' : 'bg-white/[0.03]'
            }`} style={{ width: '24px' }} title={`${dia.count} atividades`} />
            <span className={`text-[9px] font-medium ${dia.active ? 'text-gray-400' : 'text-gray-600'}`}>{dia.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-white/[0.03]">
        <span className="text-gray-500">Total 7 dias</span>
        <span className="text-white font-medium tabular-nums">{totalSemana} atividades</span>
      </div>
    </div>
  );
}

function MoodMiniGraph() {
  const moodHistory = useAppStore(s => s.moodHistory);
  const recent = moodHistory.slice(-24);

  const moodLabels: Record<string, string> = {
    stress: 'Estresse', anxiety: 'Ansiedade', sadness: 'Tristeza', tired: 'Cansaço',
    demotivated: 'Desmotivação', focused: 'Foco', motivated: 'Motivação',
    happy: 'Alegria', energetic: 'Energia', neutral: 'Neutro',
  };

  const timeline = useMemo(() => {
    if (recent.length === 0) return [];
    const entries = [...recent];
    const minTime = entries[0]?.timestamp || Date.now();
    const maxTime = entries[entries.length - 1]?.timestamp || Date.now();
    const range = Math.max(maxTime - minTime, 1);
    return entries.map(e => ({ ...e, x: ((e.timestamp - minTime) / range) * 100 }));
  }, [recent]);

  if (recent.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">Converse com o Mentor para gerar registros emocionais.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-[2px] h-14 relative">
        {timeline.map((entry, i) => (
          <div key={i}
            className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-80 hover:scale-y-110 origin-bottom cursor-pointer relative group"
            style={{
              backgroundColor: MOOD_COLOR[entry.mood] || '#475569',
              height: `${25 + (Object.values(MOOD_COLOR).indexOf(MOOD_COLOR[entry.mood] || '#475569') / Object.keys(MOOD_COLOR).length) * 40}%`,
              minHeight: '8px',
            }}
            title={`${moodLabels[entry.mood] || entry.mood} · ${new Date(entry.timestamp).toLocaleTimeString()}`}>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> Estresse</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Ansiedade</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> Tristeza</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Positivo</span>
      </div>
    </div>
  );
}