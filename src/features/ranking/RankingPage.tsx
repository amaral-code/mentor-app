import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { atrasoDoItem, MAX_STAGGER } from '../../shared/lib/motionPresets';
import { Medal, TrendingUp, Trophy, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ListSkeleton } from '../../shared/ui/Skeleton';
import { getRankingData } from '../../shared/lib/rankingEngine';
import { calcLevel } from '../../shared/lib/utils';
import type { RankingFilter, RankingData, RankingEntry } from '../../shared/types';
import { CabecalhoPagina } from '../../shared/ui/CabecalhoPagina';

const FILTERS: { id: RankingFilter; label: string; icon: typeof Trophy }[] = [
  { id: 'geral', label: 'Geral', icon: Trophy },
  { id: 'turma', label: 'Turma', icon: Users },
  { id: 'escola', label: 'Escola', icon: TrendingUp },
];

/* O brief pede Medal em tres cores para o podio. Eram emojis, que cada
   sistema desenhava diferente. */
const MEDALHA_COR = ['text-amber-600', 'text-slate-700', 'text-orange-700'];

/** Inicial do apelido: identifica sem expor nome real e sem emoji. */
function inicialDoApelido(nome: string): string {
  return (nome.trim()[0] || '?').toUpperCase();
}

/**
 * Linha do ranking, memoizada.
 *
 * Sao ate 48 entradas. Sem memo, qualquer mudanca de estado no pai (troca
 * de filtro, chegada de XP) reconstroi as 48. E tambem pre-requisito para
 * o stagger da proxima fase: animar itens que re-renderizam em cascata
 * produz exatamente o engasgo que a animacao deveria evitar.
 */
const EntryRow = memo(function EntryRow({ entry, isCurrentUser }: { entry: RankingEntry; isCurrentUser: boolean }) {
  const isTop3 = entry.posicao <= 3;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-200 border-2 ${
        isCurrentUser
          ? 'bg-ceu-100 border-ceu-500'
          : 'hover:bg-slate-50 border-transparent'
      }`}
    >
      {/* Position */}
      <div className="w-8 shrink-0 text-center">
        {isTop3 ? (
          <Medal size={20} className={`mx-auto ${MEDALHA_COR[entry.posicao - 1]}`} />
        ) : (
          <span className="text-base font-black tabular-nums text-slate-500">{entry.posicao}</span>
        )}
      </div>

      {/* Avatar */}
      {isCurrentUser ? (
        <div className="w-10 h-10 rounded-full bg-ceu-500 flex items-center justify-center text-base font-black text-white shrink-0">
          {entry.avatarInicial}
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-azul-100 flex items-center justify-center text-base font-black text-azul-600 shrink-0">
          {inicialDoApelido(entry.nome)}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-base font-extrabold truncate ${isCurrentUser ? 'text-ceu-700' : 'text-tinta-900'}`}>
            {entry.nome}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] font-extrabold text-white bg-ceu-500 px-2 py-0.5 rounded-full shrink-0">VOCÊ
            </span>
          )}
        </div>
        {/* Uma linha so: quebrando em tres, a altura variava e o ranking
            ficava dificil de varrer com o olho. */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
          <span className="truncate">{entry.turma}</span>
          <span className="w-1 h-1 rounded-full bg-slate-200 shrink-0" />
          <span className="truncate">{entry.escola}</span>
        </div>
      </div>

      {/* XP */}
      <div className="text-right shrink-0">
        <p className="text-sm font-black tabular-nums text-tinta-900">{entry.xp.toLocaleString('pt-BR')} XP</p>
        <div className="flex items-center justify-end gap-1">
          <p className="text-[10px] text-slate-500 tabular-nums">Nv.{entry.level}</p>
          {entry.variacao !== 0 && entry.variacao !== undefined && (
            <span className={`text-[10px] font-medium ${(entry.variacao || 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {(entry.variacao || 0) > 0 ? '+' : ''}{entry.variacao}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* Pódio dos três primeiros: 2º à esquerda, 1º no centro (mais alto), 3º à direita. */
function Podio({ entradas }: { entradas: RankingEntry[] }) {
  const ordem = [entradas[1], entradas[0], entradas[2]];
  const altura = ['h-20', 'h-28', 'h-16'];
  const cor = ['bg-slate-300', 'bg-amber-500', 'bg-orange-300'];
  return (
    <div className="flex items-end justify-center gap-3 pt-2" aria-label="Pódio">
      {ordem.map((e, i) => (
        <div key={`${e.nome}_${e.escolaId}`} className="flex-1 max-w-[120px] flex flex-col items-center">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black border-4 border-white ${
              e.destaque ? 'bg-ceu-500 text-white' : 'bg-azul-100 text-azul-600'
            }`}
          >
            {inicialDoApelido(e.nome)}
          </div>
          <p className="mt-1.5 text-sm font-extrabold text-tinta-900 truncate max-w-full">{e.nome}</p>
          <p className="text-xs font-bold text-slate-500 tabular-nums">{e.xp.toLocaleString('pt-BR')} XP</p>
          <div className={`mt-2 w-full ${altura[i]} ${cor[i]} rounded-t-2xl flex items-start justify-center pt-2`}>
            <span className="text-2xl font-black text-white tabular-nums">{e.posicao}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RankingPage() {
  const reduzir = useReducedMotion();
  const session = useAppStore((s) => s.session);
  const gamification = useAppStore((s) => s.gamification);
  const [filter, setFilter] = useState<RankingFilter>('geral');
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroRanking, setErroRanking] = useState<string | null>(null);

  /*
   * A carga NAO depende mais de gamification.xp.
   *
   * Antes o XP estava nas dependencias, entao cada ponto ganho regenerava
   * as 48 entradas do zero, com hash de string por apelido. Sob CPU 4x
   * isso aparecia como bloqueio de ~300ms. Agora a lista e montada uma vez
   * por filtro, e a linha do proprio aluno e atualizada em separado, que
   * custa uma reordenacao de 49 itens.
   */
  const loadRanking = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setErroRanking(null);
    try {
      const result = await getRankingData(filter, session.uid, gamification.xp, gamification.streak);
      setData(result);
    } catch {
      // Sem try/finally o skeleton ficava infinito numa falha de rede.
      setErroRanking('Não foi possível carregar o ranking. Tente de novo.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, session?.uid]);

  useEffect(() => { loadRanking(); }, [loadRanking]);

  /** Reflete o XP atual do aluno sem refazer a lista inteira. */
  const entradas = useMemo(() => {
    if (!data) return [];
    const nivelLocal = calcLevel(gamification.xp).level;
    const atualizadas = data.entries.map(e =>
      e.destaque ? { ...e, xp: gamification.xp, streak: gamification.streak, level: nivelLocal } : e,
    );
    atualizadas.sort((a, b) => b.xp - a.xp);
    return atualizadas.map((e, i) => ({ ...e, posicao: i + 1 }));
  }, [data, gamification.xp, gamification.streak]);

  const currentUserEntry = entradas.find(e => e.destaque);

  /*
   * As linhas entram em blocos, nao todas de uma vez.
   *
   * Medido: 49 linhas x 23 nos = 1127 nos de DOM, 95% de tudo que existe
   * nesta pagina, criados no MESMO quadro em que a aba abre. Isso rendia
   * uma tarefa de ~180ms, e enquanto ela roda o navegador nao consegue
   * desenhar a transicao: e exatamente o engasgo que a animacao deveria
   * evitar. `content-visibility` ja evita PINTAR o que esta fora da tela,
   * mas nao evita CRIAR os nos, entao nao resolvia este caso.
   *
   * Agora o primeiro quadro monta so o que cabe na tela e o restante entra
   * nos quadros ociosos seguintes. As linhas que ainda nao existem ocupam
   * um espacador de 1 no com a mesma altura (63px, medida e uniforme
   * desde que a linha secundaria passou a truncar), entao a lista ja nasce
   * com a altura final e a rolagem nao pula sob o dedo de quem comecou a
   * rolar antes de terminar.
   */
  /*
   * O primeiro bloco cobre a tela; os seguintes sao maiores.
   *
   * Blocos pequenos e iguais (6 em 6) resolviam a tarefa longa mas a lista
   * demorava mais de 3s para completar sob CPU 4x, e quem rolasse rapido
   * encontrava buracos. O que importa mesmo e nao competir com a TRANSICAO
   * de entrada, que dura ~300ms: depois dela um bloco maior passa
   * despercebido, porque nao ha animacao para engasgar.
   *
   * Entao: 10 linhas no primeiro quadro (o que cabe em 812px de altura),
   * e o restante em blocos de 20, fechando as 49 em tres passos.
   */
  const PRIMEIRO_BLOCO = 10;
  const BLOCO_SEGUINTE = 20;
  const [renderizadas, setRenderizadas] = useState(PRIMEIRO_BLOCO);

  // Recomeça a cada troca de filtro: a lista nova tem outras linhas.
  useEffect(() => { setRenderizadas(PRIMEIRO_BLOCO); }, [filter]);

  useEffect(() => {
    if (renderizadas >= entradas.length) return;
    /*
     * requestIdleCallback cede a vez para rolagem e toque. O `timeout`
     * e essencial: sem ele, um aparelho que nunca fica ocioso adia o
     * bloco indefinidamente e a lista nunca termina de preencher.
     * Safari ainda nao tem a API, e ali o setTimeout faz o papel.
     */
    const agendar =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 32));
    const cancelar = window.cancelIdleCallback ?? window.clearTimeout;
    const id = agendar(() => setRenderizadas((n) => n + BLOCO_SEGUINTE), { timeout: 250 });
    return () => cancelar(id as number);
  }, [renderizadas, entradas.length]);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <CabecalhoPagina titulo="Ranking" subtitulo="Compare seu desempenho com outros alunos" cor="ambar" pose="pulando" />

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map(f => {
          const isActive = filter === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={isActive}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-2xl text-sm font-extrabold border-2 transition-colors ${
                isActive
                  ? 'bg-ceu-100 text-ceu-600 border-ceu-500'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Stats summary */}
      {data && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="cartao px-4 py-3 text-center">
            <p className="text-xl font-black text-tinta-900 tabular-nums">{data.totalParticipantes}</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Participantes</p>
          </div>
          <div className="cartao px-4 py-3 text-center">
            <p className="text-xl font-black text-tinta-900 tabular-nums">
              {currentUserEntry?.posicao ? `${currentUserEntry.posicao}°` : 'sem posição'}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Sua posição</p>
          </div>
          <div className="cartao px-4 py-3 text-center">
            <p className="text-xl font-black text-tinta-900 tabular-nums">
              {gamification.xp.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Seu XP</p>
          </div>
          <div className="cartao px-4 py-3 text-center">
            <p className="text-xl font-black text-tinta-900 tabular-nums"> Nv. {calcLevel(gamification.xp).level}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">Seu nível</p>
          </div>
        </div>
      )}

      {/* Pódio: os três primeiros em destaque, como nas ligas do Duolingo.
          A lista completa continua logo abaixo, com as mesmas linhas. */}
      {!loading && !erroRanking && entradas.length >= 3 && <Podio entradas={entradas.slice(0, 3)} />}

      {/* Sozinho na lista: a tela diz isso, em vez de inventar colegas. */}
      {!loading && !erroRanking && entradas.length === 1 && (
        <div className="cartao p-5 text-center" role="status">
          <p className="text-sm font-bold text-tinta-900">Por enquanto só você aparece aqui</p>
          <p className="text-sm text-slate-600 mt-1">
            Os colegas entram no ranking assim que ganharem XP. Chame a turma para estudar junto.
          </p>
        </div>
      )}

      {/* Ranking list */}
      <div className="cartao overflow-hidden">
        {erroRanking && !loading ? (
          <div className="p-6 text-center">
            <p className="text-sm text-amber-600">{erroRanking}</p>
            <button
              onClick={loadRanking}
              className="mt-3 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-400/30 text-sm font-semibold hover:brightness-110 transition-all"
            >
              Tentar de novo
            </button>
          </div>
        ) : loading ? (
          // Skeleton compartilhado, em vez do gradiente inline duplicado
          // que existia so aqui.
          <div className="p-6">
            <ListSkeleton rows={8} />
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {/* Header info */}
            {data && entradas.length === 0 && (
              <div className="text-center py-12 flex flex-col items-center">
                {/* Estado vazio com o mascote em vez de caixa cinza */}
                <img
                  src="/assets/sagui_meditando_2.png"
                  alt=""
                  width={112}
                  height={112}
                  loading="lazy"
                  className="w-28 h-28 object-contain mb-3 opacity-90 motion-safe:animate-float-suave"
                />
                <p className="text-slate-700 font-medium">Ranking ainda vazio</p>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                  Chame a galera da sua turma. O sagui guarda o primeiro lugar.
                </p>
              </div>
            )}
            {/* `layout` faz a linha DESLIZAR quando a posicao muda, que num
                ranking e parte da recompensa. Mas o Motion precisa MEDIR
                cada elemento com layout a cada quadro, e com 49 linhas isso
                custou 265ms de bloqueio no teste sob CPU 4x.
                Solucao: so as MAX_STAGGER primeiras animam. Sao as que o
                aluno realmente ve; da 11a em diante a linha entra pronta,
                exatamente como o brief pede. */}
            {entradas.map((entry, i) => {
              const chave = `${entry.nome}_${entry.escolaId}`;

              /* Ainda nao montada: reserva a altura com um no so. */
              if (i >= renderizadas) {
                return <div key={chave} className="linha-ranking h-[63px]" />;
              }

              const linha = <EntryRow entry={entry} isCurrentUser={!!entry.destaque} />;

              if (reduzir || i >= MAX_STAGGER) {
                return <div key={chave} className="linha-ranking">{linha}</div>;
              }

              return (
                <m.div
                  key={chave}
                  className="linha-ranking"
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: atrasoDoItem(i), duration: 0.25 }}
                >
                  {linha}
                </m.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="text-center text-xs text-slate-400 leading-relaxed">
        <p><Trophy size={16} className="inline-block align-[-0.15em] text-amber-600" /> Ranking atualizado em tempo real. Complete atividades e quizzes para ganhar XP e subir posições!</p>
      </div>
    </div>
  );
}
