import { Fragment, useEffect, useMemo, useState, useSyncExternalStore, memo, useRef, useCallback } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { listContainer, listItem } from '../../shared/lib/motionPresets';
import { AnimatedNumber } from '../../shared/ui/AnimatedNumber';
import { BarChart3, BookOpen, Camera, Check, Frown, Moon, Target, Timer, Trophy, X, Zap } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { AvisoMensagens } from '../psicologia/AvisoMensagens';
import { FADIGA_ZERADA } from '../../shared/lib/burnoutModel';
import { getSSCColor, getSSCLabel } from '../../shared/lib/sscCalculator';
import { MicroTask, QuizResult } from '../../shared/types';
import { calcLevel, getToday, MOOD_LABEL, MOOD_COLOR } from '../../shared/lib/utils';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { safeSet } from '../../shared/lib/safeStorage';
import { AppIcon, MoodIcon } from '../../shared/ui/AppIcon';
import { BurnoutCard } from './BurnoutCard';
import { CartaoDicaSagui, CartaoLigas, CartaoOfensiva } from '../../app/PainelLateral';
import { CabecalhoPagina } from '../../shared/ui/CabecalhoPagina';

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
      <button aria-label="Fechar" tabIndex={-1} onClick={fechar} className="absolute inset-0 bg-tinta-900/40" />
      <div className="relative w-full max-w-sm cartao p-6 animate-fade-up max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <button onClick={fechar} aria-label="Fechar comprovação" className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-tinta-900">
          <X size={16} />
        </button>
        <p className="text-xs text-amber-600 uppercase tracking-widest font-extrabold">Comprovação</p>
        <h2 className="text-xl font-black text-tinta-900 mt-1 pr-8">{tarefa.titulo}</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Clicar não basta: mostre que fez. Envie uma <strong className="text-slate-700">foto</strong> ou
          escreva <strong className="text-slate-700">o que aprendeu</strong> (mín. {MIN_PARAGRAFO} letras).
        </p>

        <input ref={inputFoto} type="file" accept="image/*" capture="environment" onChange={aoEscolherFoto} className="hidden" aria-hidden="true" tabIndex={-1} />
        {fotoUrl ? (
          <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 relative">
            <img src={fotoUrl} alt="Comprovação da tarefa" className="w-full h-auto max-h-48 object-cover" />
            <button onClick={() => { revogarFoto(); setFotoUrl(null); }} className="absolute top-2 right-2 text-xs font-bold px-2.5 py-1 rounded-lg bg-white border-2 border-slate-200 text-tinta-900">
              Trocar foto
            </button>
          </div>
        ) : (
          <button onClick={() => inputFoto.current?.click()} className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-bold text-ceu-600 hover:border-ceu-500 hover:bg-ceu-50 transition-colors min-h-[52px]">
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
        <p className={`text-[11px] mt-1 tabular-nums ${texto.trim().length >= MIN_PARAGRAFO ? 'text-emerald-600' : 'text-slate-400'}`}>
          {texto.trim().length}/{MIN_PARAGRAFO} letras
        </p>

        <button
          onClick={() => { const t = texto.trim(); revogarFoto(); onConfirmar({ texto: t, temFoto: !!fotoUrl }); }}
          disabled={!pronto}
          className="btn-ambar w-full h-12 mt-4 uppercase"
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

  const tarefas = dailyPlan?.tasks ?? [];
  const feitas = tarefas.filter((t) => t.completed).length;
  /* A "bolinha atual" da trilha é a primeira tarefa ainda aberta. */
  const idAtual = tarefas.find((t) => !t.completed)?.id ?? null;
  const tarefaAtual = tarefas.find((t) => t.id === idAtual) ?? null;

  return (
    <div className="animate-fade-up xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8 xl:items-start space-y-5 xl:space-y-0">
      {/* ================= Coluna principal: humor + trilha ================= */}
      <div className="space-y-5 min-w-0">
        <AvisoMensagens />
        <CabecalhoPagina
          titulo={`Olá, ${session?.nome?.split(' ')[0] || 'Estudante'}!`}
          subtitulo="Bora manter a ofensiva hoje?"
          cor="ceu"
          pose="acenando"
        />

        {/* Como você está: humor (das conversas), prontidão SSC e o estado
            físico que o aluno declara nos controles deslizantes. */}
        <section className="cartao p-4 md:p-5 space-y-4" aria-label="Como você está">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${moodColor}22` }}
            >
              <MoodIcon mood={currentMood} size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-extrabold text-tinta-900 leading-tight">{MOOD_LABEL[currentMood] || 'Tranquilo'}</p>
              <p className="text-xs font-semibold text-slate-500">Humor baseado nas conversas</p>
            </div>
            <div
              className="flex flex-col items-center px-3 py-1.5 rounded-2xl shrink-0"
              style={{ backgroundColor: `${sscColor}1F` }}
              title="Prontidão (SSC): quanto o seu corpo e a sua cabeça aguentam de estudo hoje"
            >
              <span className="text-lg font-black tabular-nums leading-tight" style={{ color: sscColor }}>
                <AnimatedNumber value={sscScore} sufixo="%" />
              </span>
              <span className="text-[11px] font-extrabold leading-tight" style={{ color: sscColor }}>{sscLevel}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <Moon size={18} className="text-ceu-500" /> Sono
                </span>
                <span className="text-sm font-extrabold text-tinta-900 tabular-nums">{sono}h</span>
              </div>
              <input type="range" min="0" max="12" step="0.5" value={sono} onChange={e => { setSono(+e.target.value); recalcSSC(); }} className="w-full" aria-label="Horas de sono" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <Frown size={18} className="text-amber-500" /> Cansaço
                </span>
                <span className="text-sm font-extrabold text-tinta-900 tabular-nums">{cansaco}/10</span>
              </div>
              <input type="range" min="0" max="10" step="1" value={cansaco} onChange={e => { setCansaco(+e.target.value); recalcSSC(); }} className="w-full" aria-label="Nível de cansaço" />
            </div>
          </div>
        </section>

        {/* Indice de fadiga: entre o estado fisico declarado e o plano do
            dia, porque e ele que justifica um plano mais leve. Desligado
            (FADIGA_ZERADA), o cartao some: mostrar "0/100" seria afirmar
            algo que o app nao esta medindo. */}
        {!FADIGA_ZERADA && <BurnoutCard />}

        {/* Faixa da "unidade" do dia, como o cabeçalho de seção do Duolingo. */}
        <div className="flex items-center gap-3 rounded-[20px] bg-azul-600 shadow-lip-azul px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
              <Timer size={14} /> Plano do dia
              {currentMood && (
                <span className="normal-case tracking-normal font-bold text-azul-200">· {MOOD_LABEL[currentMood] || 'Neutro'}</span>
              )}
            </p>
            <p className="text-lg font-extrabold text-white leading-tight mt-0.5 tabular-nums">
              {feitas} de {tarefas.length} tarefas concluídas
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl border-2 border-azul-200/60 flex items-center justify-center text-white shrink-0" aria-hidden="true">
            <Target size={22} strokeWidth={2.5} />
          </div>
        </div>

        {tarefas.length > 0 ? (
          <TrilhaDoDia
            tarefas={tarefas}
            idAtual={idAtual}
            tarefaAtual={tarefaAtual}
            xpVoando={xpVoando}
            reduzir={reduzir === true}
            onTocar={pedirComprovacao}
          />
        ) : (
          <div className="text-center py-8 flex flex-col items-center">
            <img
              src="/assets/sagui_meditando_2.png"
              alt=""
              width={96}
              height={96}
              loading="lazy"
              className="w-24 h-24 object-contain mb-2 motion-safe:animate-float-suave"
            />
            <p className="text-base font-bold text-tinta-900">Diz como você está hoje.</p>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">O sagui monta o plano a partir daí.</p>
          </div>
        )}
      </div>

      {/* ============ Coluna lateral (desktop) / fim da página (celular) ============ */}
      <aside className="space-y-5 xl:sticky xl:top-8" aria-label="Seu progresso">
        {/* No computador a coluna ganha os cartões do painel lateral; no
            celular eles já estão no topo fixo e ficariam repetidos. */}
        <div className="hidden md:block">
          <CartaoOfensiva />
        </div>
        <section className="cartao p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-tinta-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-amber-500" /> Progresso
            </h2>
            <span className="text-xs font-extrabold text-azul-600 bg-azul-100 px-2.5 py-1 rounded-full tabular-nums">Nível {nivel}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-black text-tinta-900 tabular-nums">{xpProgress}</span>
            <span className="text-sm font-bold text-slate-500 tabular-nums">/ {xpForNext} XP</span>
          </div>
          <BarraGrossa pct={(xpProgress / xpForNext) * 100} cor="#F59E0B" />
          <p className="text-xs font-semibold text-slate-500 mt-2 tabular-nums">{gamification.xp} XP acumulados</p>
        </section>

        <section className="cartao p-5">
          <h2 className="text-base font-extrabold text-tinta-900 flex items-center gap-2 mb-3">
            <BookOpen size={20} className="text-ceu-500" /> Sua semana
          </h2>
          <ActivitySummary logs={logs} />
        </section>

        <div className="hidden md:block">
          <CartaoLigas />
        </div>

        {quizResults.length > 0 && <QuizPerformance quizResults={quizResults} />}

        <section className="cartao p-5">
          <h2 className="text-base font-extrabold text-tinta-900 flex items-center gap-2 mb-3">
            <Moon size={20} className="text-violet-500" /> Biofeedback (24h)
          </h2>
          <MoodMiniGraph />
        </section>

        <div className="hidden md:block">
          <CartaoDicaSagui aba="dashboard" />
        </div>
      </aside>

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

/* Barra grossa com brilho, a mesma do componente "Barra de progresso" do Figma. */
function BarraGrossa({ pct, cor }: { pct: number; cor: string }) {
  const largura = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full rounded-full relative xp-bar" style={{ width: `${largura}%`, backgroundColor: cor }}>
        {largura > 8 && <span className="absolute left-2 right-2 top-1 h-1 rounded-full bg-white/35" aria-hidden="true" />}
      </div>
    </div>
  );
}

/*
 * Trilha do dia (o "caminho" do Duolingo), feita com as MESMAS tarefas do
 * Plano do Dia. Cada bolinha é um botão: tocar abre a comprovação, igual ao
 * checkbox de antes. Tarefa concluída não volta atrás: era o ciclo
 * marcar/desmarcar que dava XP infinito.
 */
const ZIGUEZAGUE = [0, 56, 84, 56, 0, -56, -84, -56];

/* Poses do sagui que aparecem ao longo da trilha no computador. */
const POSES_TRILHA = ['pulando', 'meditando', 'aprovacao'];

/* Tela larga (lg+): no computador a trilha abre mais o zigue-zague e cresce,
   senão ela ficava uma fila fina no meio de uma coluna enorme. Sem
   matchMedia (testes em jsdom), vale o tamanho do celular. */
function useTelaLarga(): boolean {
  const consulta = '(min-width: 1024px)';
  return useSyncExternalStore(
    (avisar) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(consulta);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(consulta).matches),
    () => false,
  );
}

function TrilhaDoDia({
  tarefas,
  idAtual,
  tarefaAtual,
  xpVoando,
  reduzir,
  onTocar,
}: {
  tarefas: MicroTask[];
  idAtual: string | null;
  tarefaAtual: MicroTask | null;
  xpVoando: string | null;
  reduzir: boolean;
  onTocar: (t: MicroTask) => void;
}) {
  const larga = useTelaLarga();
  const fator = larga ? 1.7 : 1;
  const todasFeitas = tarefas.length > 0 && tarefas.every((t) => t.completed);
  return (
    <div className="relative py-2 lg:py-4">
      {/* O sagui acompanha a trilha, do lado oposto ao primeiro "S". */}
      <img
        src="/assets/sagui_estudando_2.png"
        alt=""
        width={120}
        height={120}
        loading="lazy"
        className="absolute left-0 sm:left-4 lg:left-6 top-24 lg:top-20 w-24 sm:w-28 lg:w-36 h-auto pointer-events-none select-none motion-safe:animate-float-suave"
      />
      <m.ol
        className="relative flex flex-col items-center gap-2"
        variants={reduzir ? undefined : listContainer}
        initial={reduzir ? false : 'inicial'}
        animate={reduzir ? undefined : 'animar'}
      >
        {tarefas.map((task, i) => {
          const atual = task.id === idAtual;
          const deslocamento = ZIGUEZAGUE[i % ZIGUEZAGUE.length] * fator;
          /* A cada três tarefas, outro sagui do lado oposto da curva. */
          const poseExtra = larga && i % 3 === 2 ? POSES_TRILHA[Math.floor(i / 3) % POSES_TRILHA.length] : null;
          return (
            <Fragment key={task.id}>
            <m.li
              variants={reduzir ? undefined : listItem}
              className="relative flex flex-col items-center w-44 lg:w-52"
              /* `x` (e não style.transform): a animação de entrada também
                 escreve transform, e apagava o deslocamento do zigue-zague. */
              style={{ x: deslocamento }}
            >
              {atual && (
                <span className="mb-2 px-3 py-1.5 rounded-xl bg-white border-2 border-slate-200 text-sm font-extrabold uppercase tracking-wide text-azul-600 motion-safe:animate-float-suave" aria-hidden="true">
                  Começar
                </span>
              )}
              <button
                type="button"
                onClick={() => onTocar(task)}
                disabled={task.completed}
                aria-label={task.completed ? `Concluída: ${task.titulo}` : `Comprovar e concluir: ${task.titulo}`}
                className={`relative w-[76px] h-[70px] lg:w-[100px] lg:h-[92px] rounded-full flex items-center justify-center transition-transform active:translate-y-1 active:shadow-none disabled:cursor-default disabled:active:translate-y-0 ${
                  task.completed
                    ? 'bg-amber-500 shadow-lip-ambar text-white disabled:shadow-lip-ambar'
                    : atual
                      ? 'bg-azul-600 shadow-lip-azul text-amber-300 ring-[6px] ring-ceu-100'
                      : 'bg-azul-100 shadow-lip text-azul-600 hover:bg-azul-200'
                }`}
              >
                <span className="lg:scale-[1.3] flex">
                  {task.completed
                    ? <Check size={34} strokeWidth={3.5} />
                    : <AppIcon name={task.icon} size={30} />}
                </span>
              </button>
              {poseExtra && (
                <img
                  src={`/assets/sagui_${poseExtra}_2.png`}
                  alt=""
                  width={128}
                  height={128}
                  loading="lazy"
                  className={`absolute top-0 w-32 h-32 object-contain pointer-events-none select-none motion-safe:animate-float-suave ${deslocamento >= 0 ? '-left-40' : '-right-40'}`}
                />
              )}
              {/* Recompensa na hora: o XP sobe da própria bolinha concluída. */}
              {xpVoando === task.id && (
                <span className="pointer-events-none absolute -right-2 top-0 text-base font-black text-amber-600 motion-safe:animate-fade-up-out">
                  +20 XP
                </span>
              )}
              <span className={`mt-2 text-xs lg:text-sm font-extrabold text-center leading-tight ${task.completed ? 'text-slate-400 risco risco--feito' : 'text-tinta-900'}`}>
                {task.titulo}
              </span>
            </m.li>
            {/* O detalhe da tarefa atual abre logo abaixo da bolinha dela. */}
            {atual && tarefaAtual && (
              <li className="relative z-10 w-full max-w-md my-3 rounded-[20px] border-2 border-ceu-500 bg-azul-50 shadow-lip-ceu p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-600 leading-relaxed">{tarefaAtual.descricao}</p>
                <p className="flex items-center gap-1 text-sm font-extrabold text-amber-600">
                  <Zap size={16} fill="currentColor" /> +20 XP
                </p>
                <button type="button" onClick={() => onTocar(tarefaAtual)} className="btn-ambar w-full h-12 uppercase">
                  Comprovar e concluir
                </button>
              </li>
            )}
            </Fragment>
          );
        })}
        {/* Fim do caminho: o troféu acende quando o plano do dia fecha.
            Só visual; não dá XP nem libera nada a mais. */}
        <li className="hidden lg:flex flex-col items-center mt-4" aria-label={todasFeitas ? 'Plano do dia completo' : 'Fim da trilha de hoje'}>
          <span
            className={`w-[112px] h-[104px] rounded-[28px] flex items-center justify-center ${
              todasFeitas ? 'bg-amber-500 shadow-lip-ambar text-white' : 'bg-slate-200 shadow-lip text-slate-400'
            }`}
          >
            <Trophy size={52} strokeWidth={2.5} />
          </span>
          <span className={`mt-2 text-sm font-extrabold ${todasFeitas ? 'text-amber-600' : 'text-slate-400'}`}>
            {todasFeitas ? 'Plano do dia completo!' : 'Termine a trilha para fechar o dia'}
          </span>
        </li>
      </m.ol>
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
    <section className="cartao p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-extrabold text-tinta-900 flex items-center gap-2">
          <Target size={20} className="text-emerald-500" /> Acertos por matéria
        </h2>
        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
          media >= 70 ? 'bg-emerald-500/10 text-emerald-600' : media >= 40 ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600'
        }`}>
          {media}% média
        </span>
      </div>
      <div className="space-y-3">
        {perMateria.map(m => (
          <div key={m.materia} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-bold text-tinta-900 truncate">{m.materia}</span>
                <span className="text-xs font-bold text-slate-500 tabular-nums ml-2 shrink-0">{m.acertos}/{m.total}</span>
              </div>
              <BarraGrossa pct={m.pct} cor={m.pct >= 70 ? '#10b981' : m.pct >= 40 ? '#f59e0b' : '#ef4444'} />
            </div>
            <span className={`text-sm font-black tabular-nums w-11 text-right ${
              m.pct >= 70 ? 'text-emerald-600' : m.pct >= 40 ? 'text-amber-600' : 'text-red-600'
            }`}>{m.pct}%</span>
          </div>
        ))}
      </div>
    </section>
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
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1 capitalize">
        <span>{hojeRef}</span>
        <span className="text-tinta-900 font-extrabold tabular-nums normal-case">{totalHoje} atividade{totalHoje !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {semana.map((dia, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`w-full aspect-square rounded-xl transition-all ${
              dia.active ? 'bg-amber-500 shadow-lip-ambar' : 'bg-slate-200'
            }`} title={`${dia.count} atividades`} />
            <span className={`text-[11px] font-bold capitalize ${dia.active ? 'text-amber-600' : 'text-slate-400'}`}>{dia.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t-2 border-slate-100">
        <span className="font-semibold text-slate-500">Total 7 dias</span>
        <span className="text-tinta-900 font-extrabold tabular-nums">{totalSemana} atividades</span>
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
    return <p className="text-sm text-slate-500 text-center py-4">Converse com o Mentor para gerar registros emocionais.</p>;
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
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> Estresse</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Ansiedade</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> Tristeza</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Positivo</span>
      </div>
    </div>
  );
}