import { useEffect, useMemo, useState, memo, useRef, useCallback } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { listContainer, listItem } from '../../shared/lib/motionPresets';
import { AnimatedNumber } from '../../shared/ui/AnimatedNumber';
import { Camera, Check, Flame, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { AvisoMensagens } from '../psicologia/AvisoMensagens';
import { FADIGA_ZERADA } from '../../shared/lib/burnoutModel';
import { getSSCColor } from '../../shared/lib/sscCalculator';
import { atividadeDaSemana, faixaSobrecarga, plural, saudacao } from '../../shared/lib/central';
import { MicroTask, QuizResult } from '../../shared/types';
import { calcLevel, getToday, MOOD_LABEL, MOOD_COLOR } from '../../shared/lib/utils';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { safeSet } from '../../shared/lib/safeStorage';
import { MoodIcon } from '../../shared/ui/AppIcon';
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
      <button aria-label="Fechar" tabIndex={-1} onClick={fechar} className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm camada rounded-2xl p-6 animate-scale-in max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <button onClick={fechar} aria-label="Fechar comprovação" className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-white">
          <X size={16} />
        </button>
        <p className="text-xs text-gray-500">Concluir tarefa</p>
        <h2 className="text-lg text-white mt-0.5 pr-8">{tarefa.titulo}</h2>
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
  const sscColor = getSSCColor(sscScore);

  const faixa = faixaSobrecarga(sscScore);
  const feitas = dailyPlan?.tasks.filter((t) => t.completed).length || 0;
  const totalTarefas = dailyPlan?.tasks.length || 0;
  const primeiroNome = session?.nome?.split(' ')[0] || 'estudante';
  const hojeExtenso = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );

  return (
    <div className="space-y-8">
      <AvisoMensagens />

      {/* Cabeçalho: quem, quando e a sequência. Sem ícone decorativo:
          a página é "o seu dia", e o dia é o título. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-sm text-gray-500 first-letter:uppercase">{hojeExtenso}</p>
          <h1 className="text-[1.75rem] md:text-[2rem] text-white mt-0.5">
            {saudacao(new Date().getHours())}, {primeiroNome}.
          </h1>
        </div>
        <p
          className={`flex items-center gap-1.5 text-sm ${gamification.streak >= 3 ? 'text-amber-400' : 'text-gray-400'}`}
          title="Dias seguidos com alguma atividade"
        >
          <Flame size={16} fill={gamification.streak >= 3 ? 'currentColor' : 'none'} aria-hidden="true" />
          <span className="font-semibold tabular-nums"><AnimatedNumber value={gamification.streak} /></span>
          {gamification.streak === 1 ? 'dia seguido' : 'dias seguidos'}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10 items-start">
        {/* ============ Plano do dia: a ação principal da tela ============ */}
        <section aria-labelledby="plano-titulo">
          <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-linha">
            <h2 id="plano-titulo" className="text-xl text-white">Plano de hoje</h2>
            <span className="text-sm text-gray-500 tabular-nums">
              {feitas} de {totalTarefas} {totalTarefas === 1 ? 'feita' : 'feitas'}
            </span>
          </div>

          {dailyPlan && dailyPlan.tasks.length > 0 ? (
            <m.ol
              className="pauta"
              variants={reduzir ? undefined : listContainer}
              initial={reduzir ? false : 'inicial'}
              animate={reduzir ? undefined : 'animar'}
            >
              {dailyPlan.tasks.map((task, i) => (
                <m.li variants={reduzir ? undefined : listItem} key={task.id} className="relative">
                  {/* Recompensa na hora: o XP sobe do próprio item concluído */}
                  {xpVoando === task.id && (
                    <span className="pointer-events-none absolute right-2 top-3 text-sm font-semibold text-amber-400 motion-safe:animate-fade-up-out">
                      +20 XP
                    </span>
                  )}
                  {/* A bolha é a do cartão-resposta: marcar a tarefa é
                      preenchê-la. Ela abre a comprovação; concluída, trava
                      (era o marcar/desmarcar que dava XP infinito). */}
                  <button
                    type="button"
                    onClick={() => pedirComprovacao(task)}
                    disabled={task.completed}
                    aria-label={task.completed ? `Concluída: ${task.titulo}` : `Comprovar e concluir: ${task.titulo}`}
                    className={`group w-full flex items-start gap-4 py-4 text-left rounded-md transition-colors ${
                      task.completed ? 'cursor-default' : 'hover:bg-folha/60 -mx-2 px-2 w-[calc(100%+1rem)]'
                    }`}
                  >
                    <span className={`bolha mt-0.5 ${task.completed ? 'bolha--marcada' : 'group-hover:border-amber-400'}`} aria-hidden="true">
                      {task.completed ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={`flex-1 min-w-0 ${task.completed ? 'opacity-50' : ''}`}>
                      <span className={`block text-[0.9375rem] font-medium ${task.completed ? 'text-gray-400 risco risco--feito' : 'text-white'}`}>
                        {task.titulo}
                      </span>
                      <span className="block text-sm text-gray-500 mt-0.5">{task.descricao}</span>
                    </span>
                    {!task.completed && (
                      <span className="text-xs font-mono text-gray-500 shrink-0 mt-1">+20 XP</span>
                    )}
                  </button>
                </m.li>
              ))}
            </m.ol>
          ) : (
            <div className="py-10 flex items-center gap-5">
              <img src="/assets/sagui_meditando_2.png" alt="" width={72} height={72} loading="lazy" className="w-[72px] h-[72px] object-contain shrink-0" />
              <div>
                <p className="text-[0.9375rem] text-gray-300">Ainda não há plano para hoje.</p>
                <p className="text-sm text-gray-500 mt-0.5">Ajuste o sono e o cansaço ao lado: o plano é montado a partir disso.</p>
                <button onClick={() => regeneratePlan()} className="btn-secondary mt-3">Montar o plano agora</button>
              </div>
            </div>
          )}
          {totalTarefas > 0 && feitas < totalTarefas && (
            <p className="text-xs text-gray-500 mt-3">
              Para concluir, mostre que fez: uma foto ou o que você aprendeu em poucas linhas.
            </p>
          )}
        </section>

        {/* ============ Como você está: o que você informa e o resultado ============ */}
        <section aria-labelledby="estado-titulo" className="painel rounded-2xl p-5">
          <h2 id="estado-titulo" className="text-lg text-white">Como você está</h2>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
            <MoodIcon mood={currentMood} size={14} />
            Humor {(MOOD_LABEL[currentMood] || 'neutro').toLowerCase()}, pelas conversas com o Mentor
          </p>

          <div className="mt-5 space-y-1">
            <label className="flex items-center justify-between text-sm" htmlFor="central-sono">
              <span className="text-gray-300">Horas de sono</span>
              <span className="font-mono text-white tabular-nums">{sono}h</span>
            </label>
            <input id="central-sono" type="range" min="0" max="12" step="0.5" value={sono} onChange={(e) => { setSono(+e.target.value); recalcSSC(); }} className="w-full" />
            <label className="flex items-center justify-between text-sm pt-1" htmlFor="central-cansaco">
              <span className="text-gray-300">Cansaço agora</span>
              <span className="font-mono text-white tabular-nums">{cansaco} de 10</span>
            </label>
            <input id="central-cansaco" type="range" min="0" max="10" step="1" value={cansaco} onChange={(e) => { setCansaco(+e.target.value); recalcSSC(); }} className="w-full" />
          </div>

          {/* Resultado logo abaixo de quem o produz: mexer no sono move
              a barra na hora, e fica claro de onde o número vem. */}
          <div className="mt-4 pt-4 border-t border-linha">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-300">Sobrecarga</span>
              <span className="text-sm" style={{ color: sscColor }}>
                <span className="numero text-xl mr-1.5"><AnimatedNumber value={sscScore} sufixo="%" /></span>
                {faixa.rotulo}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 rounded-full bg-folha-3 overflow-hidden"
              role="meter"
              aria-label="Sobrecarga"
              aria-valuenow={sscScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${sscScore}%, ${faixa.rotulo}`}
            >
              <m.div
                className="h-full w-full rounded-full origin-left"
                style={{ backgroundColor: sscColor }}
                initial={false}
                animate={{ scaleX: Math.max(0, Math.min(100, sscScore)) / 100 }}
                transition={reduzir ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22 }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Calculada com o sono, o cansaço e o humor de hoje.</p>
          </div>
        </section>
      </div>

      {/* Índice de fadiga: o que o app MEDE (respostas e horários), ao
          lado do que você declarou acima. Some se não houver dado. */}
      {!FADIGA_ZERADA && <BurnoutCard />}

      {quizResults.length > 0 && <QuizPerformance quizResults={quizResults} />}

      {/* ============ A semana: faixa aberta, sem caixa por número ============ */}
      <section aria-label="Resumo da semana" className="grid gap-6 lg:grid-cols-[1fr_1.4fr_1.4fr] lg:gap-0 lg:divide-x lg:divide-linha border-t border-linha pt-6">
        <div className="lg:pr-6">
          <p className="rotulo">Nível {nivel}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="numero text-[1.75rem] text-white">{xpProgress}</span>
            <span className="text-sm text-gray-500 tabular-nums">de {xpForNext} XP</span>
          </p>
          <div className="h-1 rounded-full bg-folha-3 overflow-hidden mt-2">
            <div className="h-full rounded-full bg-amber-500 xp-bar" style={{ width: `${(xpProgress / xpForNext) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2 tabular-nums">{gamification.xp} XP no total</p>
        </div>
        <div className="lg:px-6">
          <ActivitySummary logs={logs} />
        </div>
        <div className="lg:pl-6">
          <MoodMiniGraph />
        </div>
      </section>

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
  const cor = (pct: number) => (pct >= 70 ? '#7cc78a' : pct >= 40 ? '#e9a11c' : '#f08a70');

  /* Tabela, e não cartões: é comparação entre matérias, e o olho compara
     melhor em colunas alinhadas. */
  return (
    <section aria-labelledby="quiz-titulo">
      <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-linha">
        <h2 id="quiz-titulo" className="text-xl text-white">Acerto nos quizzes</h2>
        <span className="text-sm text-gray-500">média <span className="font-mono text-white">{media}%</span></span>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Acerto por matéria nos quizzes feitos</caption>
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th scope="col" className="font-medium py-2">Matéria</th>
            <th scope="col" className="font-medium py-2 w-1/2 hidden sm:table-cell"><span className="sr-only">Barra</span></th>
            <th scope="col" className="font-medium py-2 text-right">Acertos</th>
            <th scope="col" className="font-medium py-2 text-right w-14">%</th>
          </tr>
        </thead>
        <tbody className="pauta">
          {perMateria.map((m) => (
            <tr key={m.materia}>
              <td className="py-2.5 pr-3 text-gray-200">{m.materia}</td>
              <td className="py-2.5 pr-4 hidden sm:table-cell">
                <div className="h-1.5 rounded-full bg-folha-3 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, backgroundColor: cor(m.pct) }} />
                </div>
              </td>
              <td className="py-2.5 text-right font-mono text-gray-400 tabular-nums">{m.acertos}/{m.total}</td>
              <td className="py-2.5 text-right font-mono font-medium tabular-nums" style={{ color: cor(m.pct) }}>{m.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ActivitySummary({ logs }: { logs: { type: string; timestamp: number }[] }) {
  const { dias, totalSemana, totalHoje } = useMemo(() => atividadeDaSemana(logs), [logs]);
  const maximo = Math.max(1, ...dias.map((d) => d.total));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="rotulo">Atividade, últimos 7 dias</p>
        <p className="text-xs text-gray-500">hoje: <span className="text-white font-mono">{totalHoje}</span></p>
      </div>
      <p className="mt-1 numero text-[1.75rem] text-white">{totalSemana}</p>
      {/* Barras com altura = quantidade do dia (antes eram quadrados
          acesos ou apagados: 1 e 12 atividades pareciam iguais). */}
      <div className="mt-2 flex items-end gap-1.5 h-10" role="img" aria-label={`Atividades por dia: ${dias.map((d) => `${d.rotulo} ${d.total}`).join(', ')}`}>
        {dias.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div
              className={`w-full rounded-sm ${d.total > 0 ? (d.hoje ? 'bg-amber-500' : 'bg-gray-400') : 'bg-folha-3'}`}
              style={{ height: d.total > 0 ? `${Math.max(12, (d.total / maximo) * 100)}%` : '3px' }}
              title={plural(d.total, 'atividade')}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {dias.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-[0.6875rem] ${d.hoje ? 'text-amber-400 font-medium' : 'text-gray-500'}`}>{d.rotulo}</span>
        ))}
      </div>
    </div>
  );
}

/* Grupos de humor da legenda: os mesmos que dão a cor da faixa. */
const GRUPOS_HUMOR: { rotulo: string; cor: string; moods: string[] }[] = [
  { rotulo: 'estresse', cor: MOOD_COLOR.stress, moods: ['stress'] },
  { rotulo: 'ansiedade', cor: MOOD_COLOR.anxiety, moods: ['anxiety'] },
  { rotulo: 'desânimo ou cansaço', cor: MOOD_COLOR.sadness, moods: ['sadness', 'tired', 'demotivated'] },
  { rotulo: 'bem', cor: MOOD_COLOR.focused, moods: ['focused', 'motivated', 'happy', 'energetic'] },
  { rotulo: 'neutro', cor: MOOD_COLOR.neutral, moods: ['neutral'] },
];

function MoodMiniGraph() {
  const moodHistory = useAppStore((s) => s.moodHistory);
  const recent = useMemo(() => moodHistory.slice(-24), [moodHistory]);
  const presentes = useMemo(() => GRUPOS_HUMOR.filter((g) => recent.some((r) => g.moods.includes(r.mood))), [recent]);

  if (recent.length === 0) {
    return (
      <div>
        <p className="rotulo">Humor nas conversas</p>
        <p className="text-sm text-gray-500 mt-2">Aparece aqui depois que você conversar com o Mentor.</p>
      </div>
    );
  }

  /* Uma faixa: cada conversa é um trecho, na ordem em que aconteceu, com
     a cor do humor percebido. A versão anterior desenhava barras de
     ALTURAS diferentes, mas a altura vinha da posição da cor numa lista,
     não de nada medido: parecia um gráfico e não dizia nada. */
  return (
    <div>
      <p className="rotulo">Humor nas conversas</p>
      <p className="text-xs text-gray-500 mt-1">{plural(recent.length, 'registro')}, do mais antigo ao mais recente</p>
      <div className="mt-3 flex h-3 rounded-sm overflow-hidden gap-px" role="img" aria-label={`Humor por conversa: ${recent.map((r) => MOOD_LABEL[r.mood] || r.mood).join(', ')}`}>
        {recent.map((r, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: MOOD_COLOR[r.mood] || MOOD_COLOR.neutral }}
            title={`${MOOD_LABEL[r.mood] || r.mood} · ${new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        {presentes.map((g) => (
          <li key={g.rotulo} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: g.cor }} aria-hidden="true" />
            {g.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}
