import { useState, useEffect } from 'react';
import { Check, Sparkles, User, Users } from 'lucide-react';
import { useAppStore, persistir } from '../../stores/appStore';
import { getProfile, getEscolasCadastradas, getTurmasCadastradas } from '../../shared/lib/rankingEngine';
import type { CommunityMessage, Escola, Turma } from '../../shared/types';
import { createStudyLeague, joinLeague, normalizeStudyLeague, canJoinMoreLeagues, type StudyLeague } from '../../shared/lib/ligasEngine';
import { LeagueDetail } from './LeagueDetail';
import { EmptyState } from '../../shared/ui/EmptyState';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';

/*
 * Mural e ligas agora vivem no banco.
 *
 * O codigo anterior guardava tudo em localStorage e, em paralelo, tentava
 * sincronizar com uma tabela `community_messages` que NUNCA existiu neste
 * projeto (nome herdado do 001_schema.sql, que jamais foi aplicado). O
 * resultado era um mural que so funcionava no proprio navegador. A tabela
 * correta e mensagens_comunidade.
 */

function getLigasIniciais(): StudyLeague[] {
  return [
    createStudyLeague({
      id: 'liga_portugues',
      title: 'Liga de Português: crase e interpretação',
      prompt: 'Aprofunde a leitura crítica e explique regras gramaticais com exemplos claros.',
      authorName: 'Prof. Lígia',
      turma: '3A',
      escola: 'Escola do Sol',
      discipline: 'Português',
      xpReward: 35,
      goals: [
        { id: 'p1', title: 'Resolver 3 exercícios', description: 'Exercícios sobre crase e interpretação', target: 3, unit: 'exercícios' },
        { id: 'p2', title: 'Compartilhar 1 explicação', description: 'Explicação em texto para a equipe', target: 1, unit: 'explicação' },
      ],
    }),
    createStudyLeague({
      id: 'liga_matematica',
      title: 'Liga de Matemática: resolução em dupla',
      prompt: 'Trabalhe em colaboração para resolver problemas exatos e registrar a estratégia.',
      authorName: 'Prof. João',
      turma: '3B',
      escola: 'Escola do Sol',
      discipline: 'Matemática',
      xpReward: 40,
      goals: [
        { id: 'm1', title: 'Fazer 6 exercícios', description: 'Questões de cálculo e raciocínio', target: 6, unit: 'exercícios' },
        { id: 'm2', title: 'Enviar 1 dica', description: 'Método ou passo a passo da resolução', target: 1, unit: 'dica' },
      ],
    }),
    createStudyLeague({
      id: 'liga_fisica',
      title: 'Liga de Física: energia e movimento',
      prompt: 'Resolva problemas de mecânica, termodinâmica e eletromagnetismo em equipe.',
      authorName: 'Prof. Rafael',
      turma: '3A',
      escola: 'Escola do Sol',
      discipline: 'Física',
      xpReward: 38,
      goals: [
        { id: 'f1', title: 'Resolver 4 problemas', description: 'Problemas de cinemática e dinâmica', target: 4, unit: 'problemas' },
        { id: 'f2', title: 'Explicar 1 lei física', description: 'Escolha uma lei e explique com exemplo', target: 1, unit: 'explicação' },
      ],
    }),
    createStudyLeague({
      id: 'liga_quimica',
      title: 'Liga de Química: reações e soluções',
      prompt: 'Domine estequiometria, ligações e reações químicas com seu grupo.',
      authorName: 'Prof. Marina',
      turma: '3B',
      escola: 'Escola do Sol',
      discipline: 'Química',
      xpReward: 38,
      goals: [
        { id: 'q1', title: 'Balancear 5 equações', description: 'Equações de diferentes tipos de reação', target: 5, unit: 'equações' },
        { id: 'q2', title: 'Calcular pH', description: 'Resolver 2 problemas de pH e pOH', target: 2, unit: 'problemas' },
      ],
    }),
    createStudyLeague({
      id: 'liga_biologia',
      title: 'Liga de Biologia: genética e ecologia',
      prompt: 'Explore mecanismos evolutivos, ecossistemas e genética populacional.',
      authorName: 'Prof. Carla',
      turma: '3A',
      escola: 'Escola do Sol',
      discipline: 'Biologia',
      xpReward: 36,
      goals: [
        { id: 'b1', title: 'Resolver 3 heredogramas', description: 'Analisar heredogramas e determinar padrões', target: 3, unit: 'heredogramas' },
        { id: 'b2', title: 'Mapear 1 ecossistema', description: 'Descrever cadeia alimentar de um bioma', target: 1, unit: 'mapa' },
      ],
    }),
    createStudyLeague({
      id: 'liga_historia',
      title: 'Liga de História: Brasil República',
      prompt: 'Analise os períodos republicanos brasileiros e seus impactos sociais.',
      authorName: 'Prof. Pedro',
      turma: '3B',
      escola: 'Escola do Sol',
      discipline: 'História',
      xpReward: 35,
      goals: [
        { id: 'h1', title: 'Linha do tempo', description: 'Criar linha do tempo da República Brasileira', target: 1, unit: 'linha do tempo' },
        { id: 'h2', title: 'Debater 1 período', description: 'Debater com o grupo sobre a Era Vargas', target: 1, unit: 'debate' },
      ],
    }),
    createStudyLeague({
      id: 'liga_geografia',
      title: 'Liga de Geografia: geopolítica mundial',
      prompt: 'Entenda as relações de poder, conflitos e blocos econômicos atuais.',
      authorName: 'Prof. Sofia',
      turma: '3A',
      escola: 'Escola do Sol',
      discipline: 'Geografia',
      xpReward: 34,
      goals: [
        { id: 'g1', title: 'Analisar 1 conflito', description: 'Pesquisar e apresentar um conflito atual', target: 1, unit: 'análise' },
        { id: 'g2', title: 'Mapa temático', description: 'Criar mapa sobre fluxos econômicos', target: 1, unit: 'mapa' },
      ],
    }),
  ];
}

export function ComunidadePage() {
  const session = useAppStore((s) => s.session);
  const addXP = useAppStore((s) => s.addXP);
  const addLog = useAppStore((s) => s.addLog);
  const setToast = useAppStore((s) => s.setToast);
  const [mensagens, setMensagens] = useState<CommunityMessage[]>([]);
  const [falhaAoCarregar, setFalhaAoCarregar] = useState(false);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [ligas, setLigas] = useState<StudyLeague[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [pendingJoinLeagueId, setPendingJoinLeagueId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [mostrarFormLiga, setMostrarFormLiga] = useState(false);
  const [novoTituloLiga, setNovoTituloLiga] = useState('');
  const [novaDisciplinaLiga, setNovaDisciplinaLiga] = useState('Matemática');
  const [criandoLiga, setCriandoLiga] = useState(false);

  const profile = session ? getProfile(session.uid) : null;
  const escolaAtual = escolas.find(e => e.id === profile?.escolaId);
  const turmaAtual = turmas.find(t => t.id === profile?.turmaId);

  useEffect(() => {
    setEscolas(getEscolasCadastradas());
    setTurmas(getTurmasCadastradas());

    supabaseRepository
      .loadLigas()
      .then((remotas) => {
        // Sem ligas no banco ainda: mostra as de demonstracao para a tela
        // nao abrir vazia. Elas nao sao gravadas.
        setLigas(remotas.length > 0 ? (remotas as unknown as StudyLeague[]).map(l => normalizeStudyLeague(l)) : getLigasIniciais());
      })
      .catch(() => setLigas(getLigasIniciais()));
  }, []);

  /*
   * Distingue "o mural esta vazio" de "o mural nao carregou".
   *
   * Antes as duas situacoes produziam a mesma tela: lista vazia. O aluno
   * concluia que ninguem tinha escrito nada, quando na verdade a consulta
   * havia falhado. Sao mensagens diferentes e merecem telas diferentes.
   */
  useEffect(() => {
    if (!profile?.turmaId) return;
    supabaseRepository
      .loadMensagensTurma()
      .then((m) => { setMensagens(m); setFalhaAoCarregar(false); })
      .catch(() => setFalhaAoCarregar(true));
  }, [profile?.turmaId]);

  useEffect(() => {
    if (ligas.length === 0) return;
    if (!selectedLeagueId || !ligas.some(liga => liga.id === selectedLeagueId)) {
      const preferida = ligas.find(liga => liga.joinedBy.includes(profile?.uid || '')) || ligas[0];
      setSelectedLeagueId(preferida?.id || null);
    }
  }, [ligas, profile?.uid, selectedLeagueId]);

  /* O mural em si ainda nao tem UI de lista/envio: esta tela mostra as
     ligas e usa a contagem de mensagens só no badge do cabeçalho. Sem
     polling a cada 10s (tráfego e RLS à toa) e sem função de envio morta —
     quando o mural ganhar tela própria, o envio volta com rollback
     funcional (setMensagens(prev => ...)). */
  function aceitarLiga(liga: StudyLeague) {
    if (!profile?.uid) return;
    if (liga.joinedBy.includes(profile.uid)) {
      setViewMode('detail');
      return;
    }
    // Liga de demonstração (id em texto, sem linha no banco): entra só no
    // aparelho. Antes o app tentava gravar esse id no banco (coluna UUID)
    // e o erro desfazia a entrada — parecia que "não tem como acessar".
    const soLocal = !/^[0-9a-f-]{36}$/i.test(liga.id);
    if (pendingJoinLeagueId && pendingJoinLeagueId !== liga.id) {
      setPendingJoinLeagueId(liga.id);
      return;
    }
    if (pendingJoinLeagueId === liga.id) {
      if (!canJoinMoreLeagues(ligas, profile.uid, 2)) {
        setToast('Você já está em 2 ligas. Saia de uma para entrar em outra.', 'error');
        setPendingJoinLeagueId(null);
        return;
      }
      const updated = joinLeague(liga, profile.uid, profile.nome || 'Anônimo');
      const next = ligas.map(item => item.id === liga.id ? updated : item);
      setLigas(next);
      setSelectedLeagueId(updated.id);
      setPendingJoinLeagueId(null);
      if (!soLocal) {
        persistir(supabaseRepository.entrarNaLiga(liga.id), {
          aoFalhar: () => { setLigas(ligas); setSelectedLeagueId(null); setViewMode('list'); },
          mensagem: 'Nao foi possivel entrar na liga. Tente de novo.',
        });
        addXP(updated.xpReward);
        addLog({ timestamp: Date.now(), type: 'atividade', description: `Entrou na liga "${updated.title}"`, xp: updated.xpReward });
      } else {
        setToast('Você entrou na liga de demonstração! Crie uma liga real para valer XP e ranking.', 'info');
      }
      setViewMode('detail');
      return;
    }
    if (!canJoinMoreLeagues(ligas, profile.uid, 2)) {
      setToast('Você já está em 2 ligas. Saia de uma para entrar em outra.', 'error');
      return;
    }
    setPendingJoinLeagueId(liga.id);
  }

  /* Antes não existia como criar liga no app: o banco ficava vazio para
     sempre, a tela caía nas demonstrações e a entrada falhava no servidor.
     Este botão cria a liga de verdade (UUID) e já coloca o criador dentro. */
  async function criarLiga() {
    if (!profile?.uid || !novoTituloLiga.trim() || criandoLiga) return;
    setCriandoLiga(true);
    try {
      const rascunho = createStudyLeague({
        id: `tmp_${Date.now()}`,
        title: novoTituloLiga.trim().slice(0, 60),
        prompt: 'Liga criada pelos estudantes: definam a primeira meta juntos na sala.',
        authorName: profile.nome || 'Anônimo',
        turma: turmaAtual?.nome || '',
        escola: escolaAtual?.nome || '',
        discipline: novaDisciplinaLiga,
        xpReward: 35,
        goals: [{
          id: `g${Date.now()}`,
          title: 'Definir a primeira meta',
          description: 'Combinem na sala o primeiro desafio da equipe',
          target: 1,
          unit: 'meta',
        }],
      });
      const uuid = await supabaseRepository.saveLiga(rascunho as unknown as Record<string, any>);
      if (!uuid) throw new Error('sem retorno do banco');
      await supabaseRepository.entrarNaLiga(uuid);
      const remotas = await supabaseRepository.loadLigas();
      const normalizadas = (remotas as unknown as StudyLeague[]).map(l => normalizeStudyLeague(l));
      const criada = normalizadas.find(l => l.id === uuid);
      const comMembro = criada
        ? joinLeague(criada, profile.uid, profile.nome || 'Anônimo')
        : { ...rascunho, id: uuid } as unknown as StudyLeague;
      setLigas(criada ? normalizadas.map(l => l.id === uuid ? comMembro : l) : [comMembro, ...ligas]);
      setSelectedLeagueId(uuid);
      setMostrarFormLiga(false);
      setNovoTituloLiga('');
      addXP(35);
      addLog({ timestamp: Date.now(), type: 'atividade', description: `Criou a liga "${rascunho.title}"`, xp: 35 });
      setViewMode('detail');
      setToast('Liga criada! Chame a galera.', 'success');
    } catch {
      setToast('Não foi possível criar a liga. Tente de novo.', 'error');
    } finally {
      setCriandoLiga(false);
    }
  }

  function updateLeague(updated: StudyLeague) {
    const anterior = ligas;
    setLigas(ligas.map(item => item.id === updated.id ? updated : item));
    // Demonstração não tem linha no banco: salva só no aparelho.
    if (!/^[0-9a-f-]{36}$/i.test(updated.id)) return;
    persistir(
      supabaseRepository.atualizarLiga(updated.id, updated as unknown as Record<string, unknown>),
      {
        aoFalhar: () => setLigas(anterior),
        mensagem: 'Nao foi possivel salvar a alteracao na liga.',
      },
    );
  }

  const selectedLeague = ligas.find(liga => liga.id === selectedLeagueId) || null;
  const selectedProgress = selectedLeague && selectedLeague.goals.length > 0
    ? Math.round((selectedLeague.goals.filter(goal => (goal.completedBy || []).includes(profile?.uid || '')).length / selectedLeague.goals.length) * 100)
    : 0;
  const nextGoal = selectedLeague?.goals.find(goal => !(goal.completedBy || []).includes(profile?.uid || '')) || null;

  // Sala da Liga (detail view)
  if (viewMode === 'detail' && selectedLeague) {
    return (
      <LeagueDetail
        league={selectedLeague}
        onBack={() => setViewMode('list')}
        onUpdateLeague={updateLeague}
      />
    );
  }

  // List view
  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] md:h-[calc(100dvh-8rem)] animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 flex items-center justify-center">
            <Users size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white">Ligas de estudo</h1>
            <p className="text-xs text-gray-500">
              {turmaAtual ? `${turmaAtual.nome} • ${escolaAtual?.nome}` : 'Selecione sua turma no Perfil'}
            </p>
          </div>
        </div>
        {/* O indicador diz a verdade sobre o mural: verde quando carregou,
            ambar quando a consulta falhou. Antes as duas situacoes exibiam
            "0 mensagens", e o aluno concluia que a turma estava calada. */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span
            className={`w-2 h-2 rounded-full ${
              falhaAoCarregar ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse-subtle'
            }`}
          />
          {falhaAoCarregar ? 'mural indisponível' : `${mensagens.length} mensagens`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 scroll-smooth">
        <div className="glass rounded-2xl border border-cyan-500/10 p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm md:text-base font-semibold text-white">Seu espaço de liga</h2>
                <p className="text-xs text-gray-500">Escolha uma liga, entre nela e acesse a sala da equipe.</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-full bg-white/5 text-[10px] text-gray-400">{ligas.length} ligas</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex flex-col gap-2 lg:w-[300px] lg:shrink-0">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400">Ligas disponíveis</p>
                <button
                  onClick={() => setMostrarFormLiga(v => !v)}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:brightness-110 min-h-[36px]"
                >
                  {mostrarFormLiga ? 'Fechar' : '+ Nova liga'}
                </button>
              </div>

              {mostrarFormLiga && (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
                  <input
                    type="text"
                    value={novoTituloLiga}
                    onChange={e => setNovoTituloLiga(e.target.value)}
                    placeholder="Nome da liga (ex: Liga de Matemática 3A)"
                    maxLength={60}
                    className="w-full text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={novaDisciplinaLiga}
                      onChange={e => setNovaDisciplinaLiga(e.target.value)}
                      className="flex-1 text-sm"
                      aria-label="Disciplina"
                    >
                      {['Português', 'Matemática', 'Física', 'Química', 'Biologia', 'História', 'Geografia'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <button
                      onClick={criarLiga}
                      disabled={!novoTituloLiga.trim() || criandoLiga}
                      className="btn-primary text-sm px-4 min-h-[44px] disabled:opacity-40"
                    >
                      {criandoLiga ? 'Criando…' : 'Criar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100dvh-28rem)] lg:max-h-[calc(100dvh-24rem)] pr-1">
                {ligas.length === 0 && (
                  <EmptyState
                    pose="pulando"
                    compacto
                    titulo="Nenhuma liga por aqui"
                    descricao="Crie a primeira liga da sua turma e chame a galera para bater a meta junto."
                  />
                )}
                {ligas.map(liga => {
                  const isAccepted = liga.joinedBy.includes(profile?.uid || '');
                  const isSelected = selectedLeague?.id === liga.id;

                  const discColors: Record<string, { from: string; via: string; border: string }> = {
                    Português: { from: 'from-emerald-600', via: 'via-teal-700', border: 'border-emerald-500/20' },
                    Matemática: { from: 'from-blue-600', via: 'via-indigo-700', border: 'border-blue-500/20' },
                    Física: { from: 'from-purple-600', via: 'via-violet-700', border: 'border-purple-500/20' },
                    Química: { from: 'from-red-600', via: 'via-rose-700', border: 'border-red-500/20' },
                    Biologia: { from: 'from-green-600', via: 'via-emerald-700', border: 'border-green-500/20' },
                    História: { from: 'from-amber-600', via: 'via-yellow-700', border: 'border-amber-500/20' },
                    Geografia: { from: 'from-teal-600', via: 'via-cyan-700', border: 'border-teal-500/20' },
                    default: { from: 'from-cyan-600', via: 'via-teal-700', border: 'border-cyan-500/20' },
                  };
                  const dc = discColors[liga.discipline] || discColors.default;

                  return (
                    <button
                      key={liga.id}
                      onClick={() => { setSelectedLeagueId(liga.id); }}
                      className={`group relative w-full rounded-2xl border text-left transition-all duration-200 overflow-hidden min-h-[88px] ${
                        isSelected ? `${dc.border} shadow-lg` : 'border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${dc.from}/10 ${dc.via}/5 to-transparent opacity-${isSelected ? '100' : '0'} group-hover:opacity-100 transition-opacity`} />
                      <div className="relative p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-400">{liga.discipline}</span>
                              {isAccepted && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"><Check size={16} className="inline-block align-[-0.15em] text-emerald-400" /> Ativa</span>}
                            </div>
                            <h3 className="text-sm font-semibold text-white leading-tight">{liga.title}</h3>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <span><User size={16} className="inline-block align-[-0.15em] text-gray-400" /></span>
                              <span>{liga.authorName}</span>
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${
                            isAccepted ? 'bg-amber-500/10 text-amber-400' : 'bg-cyan-500/10 text-cyan-400'
                          }`}>
                            +{liga.xpReward} XP
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/[0.04]">
                          <div className="flex -space-x-1.5">
                            {liga.joinedByNames.slice(0, 4).map((name, i) => (
                              <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-black/30">
                                {name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {liga.joinedByNames.length > 4 && (
                              <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] text-gray-400 ring-1 ring-black/30">
                                +{liga.joinedByNames.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">{liga.joinedByNames.length} participante{liga.joinedByNames.length !== 1 ? 's' : ''}</span>
                          <div className="ml-auto hidden md:flex items-center gap-1 text-[10px] text-gray-600">
                            <span>{liga.escola}</span>
                            <span>•</span>
                            <span>{liga.turma}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedLeague ? (
              <div className="flex-1 space-y-3">
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-3 md:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-400">Liga selecionada</p>
                      <h3 className="text-base font-semibold text-white truncate">{selectedLeague.title}</h3>
                      <p className="text-xs text-gray-300 mt-1">{selectedLeague.prompt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-gray-200">{selectedLeague.discipline}</span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-[10px] text-amber-400">+{selectedLeague.xpReward} XP</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-gray-300">
                    <span className="px-2 py-0.5 rounded-full bg-black/10">{selectedLeague.escola}</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/10">{selectedLeague.turma}</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/10">{selectedLeague.joinedByNames.length} participantes</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-gray-300 min-w-0 flex-1">
                      {selectedLeague.joinedByNames.length > 0 ? `Equipe: ${selectedLeague.joinedByNames.join(', ')}` : 'Ainda sem participantes'}
                    </div>
                    <button
                      onClick={() => aceitarLiga(selectedLeague)}
                      disabled={!profile?.uid}
                      className={`px-4 md:px-3 py-2.5 md:py-1.5 rounded-xl text-sm md:text-xs font-semibold transition-all min-h-[44px] ${
                        selectedLeague.joinedBy.includes(profile?.uid || '')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : pendingJoinLeagueId === selectedLeague.id
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse-subtle'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:brightness-110'
                      }`}
                    >
                      {selectedLeague.joinedBy.includes(profile?.uid || '')
                        ? 'Acessar sala '
                        : pendingJoinLeagueId === selectedLeague.id
                          ? 'Confirmar entrada'
                          : 'Entrar na liga'}
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/8 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-400">Progresso da liga</p>
                        <p className="text-xs text-gray-300">{selectedProgress}% concluído</p>
                      </div>
                      <div className="h-2 w-24 rounded-full bg-white/10 overflow-hidden shrink-0">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${selectedProgress}%` }} />
                      </div>
                    </div>
                    {nextGoal && (
                      <div className="mt-2 rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                        <p className="text-[11px] text-gray-400">Próximo desafio</p>
                        <p className="text-sm text-white">{nextGoal.title}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-gray-500"> Escolha uma liga para abrir o painel de desafios.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
