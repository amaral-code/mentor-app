import { create } from 'zustand';
import {
  MoodType,
  TabId,
  GamificationState,
  ChatMessage,
  Nota,
  LogEntry,
  DailyPlan,
  EssayCorrection,
  QuizResult,
  Session,
  ChatPersona,
  UserRole,
  ChallengeResult,
  Conversa,
} from '../shared/types';
import { calculateSSC } from '../shared/lib/sscCalculator';
import { detectEmotion, getMoodColor } from '../shared/lib/emotionEngine';
import { analyzeMoodWithAI } from '../shared/lib/aiService';
import { generatePlan, XP_PER_TASK } from '../shared/lib/plannerEngine';
import { userRepository } from '../shared/storage/UserRepository';
import { supabaseRepository } from '../shared/storage/SupabaseRepository';
import { isSupabaseConfigured } from '../shared/lib/supabase';
import { safeSet } from '../shared/lib/safeStorage';
import { calcLevel, getToday } from '../shared/lib/utils';

interface AppState {
  session: Session | null;
  isAuthenticated: boolean;
  userRole: UserRole;

  activeTab: TabId;
  showCrisisOverlay: boolean;
  showWeeklyReport: boolean;
  showNotebookStudio: boolean;
  showTutorial: boolean;
  tutorialStep: number;
  personas: ChatPersona[];
  activePersonaId: string | null;
  showPersonaManager: boolean;
  apiKey: string;
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';

  currentMood: MoodType;
  moodHistory: { mood: MoodType; timestamp: number }[];
  moodColor: string;

  sono: number;
  cansaco: number;
  sscScore: number;

  gamification: GamificationState;

  chatMessages: ChatMessage[];
  isMuted: boolean;

  /** Threads do Mentor (migration 016). chatMessages = thread ativa. */
  conversas: Conversa[];
  conversaAtivaId: string | null;

  lastCorrection: EssayCorrection | null;

  quizResults: QuizResult[];

  notas: Nota[];

  logs: LogEntry[];

  dailyPlan: DailyPlan | null;

  challengeResults: ChallengeResult[];
  challengeSeenTutorial: boolean;

  setSession: (session: Session | null) => void;
  /**
   * Aplica a conclusao do onboarding na sessao em memoria (passo 4).
   * Patch funcional sobre a sessao atual: quem assina `s.session` inteiro
   * re-renderiza uma vez; o resto nem fica sabendo.
   */
  concluirOnboardingLocal: (dados: { metas: string[]; tempoDiario: string; turno: string }) => void;
  logout: () => void;
  setActiveTab: (tab: TabId) => void;
  setSono: (v: number) => void;
  setCansaco: (v: number) => void;
  recalcSSC: () => void;
  detectAndSetMood: (text: string) => Promise<MoodType>;
  setMood: (mood: MoodType) => void;
  addChatMessage: (msg: ChatMessage, conversaId?: string | null) => void;
  setConversas: (conversas: Conversa[]) => void;
  /** Cria thread (aguarda o id do banco quando online) e abre vazia. */
  novaConversa: () => Promise<void>;
  /** Troca a thread ativa carregando as mensagens dela. */
  selecionarConversa: (id: string | null) => Promise<void>;
  /** Apaga a thread (mensagens caem juntas no banco) e abre outra. */
  apagarConversa: (id: string) => Promise<void>;
  addXP: (n: number) => void;
  addLog: (entry: LogEntry) => void;
  setDailyPlan: (plan: DailyPlan | null) => void;
  completeTask: (taskId: string) => void;
  regeneratePlan: () => void;
  setToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setShowCrisisOverlay: (v: boolean) => void;
  setShowWeeklyReport: (v: boolean) => void;
  setShowNotebookStudio: (v: boolean) => void;
  setShowTutorial: (v: boolean) => void;
  setTutorialStep: (n: number) => void;
  setPersonas: (personas: ChatPersona[]) => void;
  addPersona: (persona: ChatPersona) => void;
  removePersona: (id: string) => void;
  setActivePersonaId: (id: string | null) => void;
  setShowPersonaManager: (v: boolean) => void;
  setApiKey: (key: string) => void;
  setIsMuted: (v: boolean) => void;
  setLastCorrection: (c: EssayCorrection | null) => void;
  addQuizResult: (r: QuizResult) => void;
  setNotas: (notas: Nota[]) => void;
  addNota: (nota: Nota) => void;
  updateGamification: (g: Partial<GamificationState>) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  setLogs: (logs: LogEntry[]) => void;
  addChallengeResult: (r: ChallengeResult) => void;
  setChallengeSeenTutorial: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  userRole: 'student',

  activeTab: 'dashboard',
  showCrisisOverlay: false,
  showWeeklyReport: false,
  showNotebookStudio: false,
  showTutorial: false,
  tutorialStep: 0,
  personas: [
    /*
     * Professores embutidos.
     *
     * Duas coisas mudaram aqui em relacao a versao anterior, e as duas
     * apareceram quando o comportamento foi testado de verdade:
     *
     * 1. ESCOPO SEPARADO DA INSTRUCAO. Antes o limite ("responda apenas
     *    sobre matematica") vivia solto no meio do texto e o modelo o
     *    tratava como sugestao. Agora o escopo e um campo, e aiService
     *    transforma isso numa regra explicita, com o que fazer quando a
     *    pergunta e de outra materia.
     *
     * 2. TOM COMPATIVEL COM O SAGUI. As instrucoes pediam "estilo
     *    analitico de pesquisador" enquanto o prompt base pede frases
     *    curtas e linguagem acessivel para aluno do noturno. Instrucao
     *    contraditoria nao e obedecida pela metade: ela e ignorada na
     *    parte que o modelo escolher.
     */
    {
      id: 'mentor_enem',
      name: 'Mentor ENEM',
      icon: 'luaCheia',
      color: '#f59e0b',
      // Sem escopo: este e o generalista, e e para ele que os outros
      // mandam o aluno quando a pergunta foge da materia.
      instruction:
        'Voce e o mentor geral do ENEM: cobre qualquer materia, estrategia de prova (logica da TRI, gestao do tempo e ordem de resolucao), redacao rumo ao 1000 e cronogramas de estudo para quem trabalha de dia e estuda a noite. Quando a pergunta for ampla, escolha um recorte e comece por ele em vez de listar tudo.',
      createdAt: 0,
    },
    {
      id: 'prof_matematica',
      name: 'Prof. Matemática',
      icon: 'regua',
      color: '#3b82f6',
      escopo: 'matemática: álgebra, funções, geometria plana e espacial, estatística, probabilidade, análise combinatória, razão e proporção',
      instruction:
        'Voce ensina matematica para o ENEM, e SOMENTE matematica. Resolva passo a passo mostrando a conta, um passo por linha, e termine apontando a pegadinha mais comum nesse tipo de questao. Quando o aluno errar, mostre em que passo o raciocinio saiu do trilho antes de dar a resposta certa. Se perguntarem de outra materia, recuse em uma frase educada e traga a conversa de volta para a matematica, oferecendo o que voce pode resolver.',
      createdAt: 0,
    },
    {
      id: 'prof_portugues',
      name: 'Prof. Português',
      icon: 'escrita',
      color: '#10b981',
      escopo: 'língua portuguesa: gramática, interpretação de texto, literatura brasileira e redação',
      instruction:
        'Voce ensina exclusivamente lingua portuguesa para o ENEM: gramatica, interpretacao de texto, literatura brasileira e redacao - e nada fora disso. Explique a regra com um exemplo curto antes da teoria, e sempre mostre a frase errada ao lado da corrigida. Em redacao, aponte a competencia do ENEM que esta em jogo.',
      createdAt: 0,
    },
    {
      id: 'prof_ciencias',
      name: 'Prof. Ciências',
      icon: 'ciencia',
      color: '#8b5cf6',
      escopo: 'ciências da natureza: biologia, física e química',
      instruction:
        'Voce ensina exclusivamente ciencias da natureza para o ENEM: biologia, fisica e quimica - e nada fora disso. Comece pelo fenomeno do cotidiano e so depois nomeie o conceito. Em calculo, deixe a unidade visivel em cada etapa.',
      createdAt: 0,
    },
    {
      id: 'prof_humanas',
      name: 'Prof. Humanas',
      icon: 'globo',
      color: '#ec4899',
      escopo: 'ciências humanas: história, geografia, filosofia e sociologia',
      instruction:
        'Voce ensina exclusivamente ciencias humanas para o ENEM: historia, geografia, filosofia e sociologia - e nada fora disso. Situe o fato no tempo e no espaco, ligue causa e consequencia, e conecte com o Brasil de hoje quando fizer sentido - e assim que a prova costuma cobrar.',
      createdAt: 0,
    },
  ],
  activePersonaId: 'mentor_enem',
  showPersonaManager: false,
  apiKey: '',
  toastMessage: null,
  toastType: 'info',

  currentMood: 'neutral',
  moodHistory: [],
  moodColor: '#10b981',

  sono: 7,
  cansaco: 4,
  sscScore: 20,

  gamification: { xp: 0, level: 1, streak: 1, lastAccessDate: getToday() },

  chatMessages: [],
  isMuted: false,
  conversas: [],
  conversaAtivaId: null,

  lastCorrection: null,
  quizResults: [],
  notas: [],
  logs: [],
  dailyPlan: null,
  // Carregados do banco no boot (App.tsx), nao mais do localStorage.
  challengeResults: [],
  challengeSeenTutorial: false,

  setSession: (session) => {
    set({ session, isAuthenticated: !!session, userRole: session?.role || 'student' });
  },

  concluirOnboardingLocal: (dados) => {
    set((s) =>
      s.session
        ? {
            session: {
              ...s.session,
              onboardingCompleted: true,
              metasEstudo: dados.metas,
              tempoDiarioEstudo: dados.tempoDiario,
              turnoEstudo: dados.turno,
            },
          }
        : s,
    );
  },

  /**
   * Sai da conta.
   *
   * A versao anterior tentava "sincronizar"logs e notas aqui, reenviando
   * tudo em massa no logout. Isso duplicava registros a cada saida, porque
   * nao havia como saber o que ja estava salvo. Agora cada acao grava na
   * hora, entao o logout so precisa encerrar a sessao e limpar a memoria.
   */
  logout: () => {
    // Silencio proposital: a sessao local e limpa logo abaixo de qualquer
    // forma. Falhar em avisar o servidor nao deve impedir o aluno de sair.
    userRepository.logout().catch(() => {});
    // Inventario vive em outro store. Sem limpar, o proximo aluno a entrar
    // no MESMO dispositivo (laboratorio da escola) via os itens do anterior.
    void import('./storeStore').then((m) => m.useStoreStore.getState().limpar()).catch(() => {});
    void import('../shared/lib/rankingEngine').then((m) => m.limparCache?.()).catch(() => {});
    set({
      session: null,
      isAuthenticated: false,
      userRole: 'student',
      activeTab: 'dashboard',
      toastMessage: null,
      showTutorial: false,
      tutorialStep: 0,
      chatMessages: [],
      notas: [],
      logs: [],
      quizResults: [],
      challengeResults: [],
      dailyPlan: null,
      conversas: [],
      conversaAtivaId: null,
      gamification: { xp: 0, level: 1, streak: 1, lastAccessDate: getToday() },
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSono: (sono) => set({ sono }),
  setCansaco: (cansaco) => set({ cansaco }),

  recalcSSC: () => {
    const { sono, cansaco, currentMood } = get();
    const ssc = calculateSSC({ sono, cansaco, mood: currentMood });
    set({ sscScore: ssc });
    if (ssc >= 70) {
      const session = get().session;
      if (session && !get().showCrisisOverlay) {
        set({ showCrisisOverlay: true });
      }
    }
  },

  detectAndSetMood: async (text) => {
    const apiKey = get().apiKey;
    let mood: MoodType;
    if (apiKey) {
      try {
        const raw = await analyzeMoodWithAI(text, apiKey);
        const cleaned = raw
          .replace(/```json\s*/gi, '')
          .replace(/```\s*$/gm, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        // O modelo pode devolver qualquer string: só aceita os 10 estados
        // válidos, senão o humor inválido quebra SSC/plano/cores.
        const validos: MoodType[] = ['stress', 'anxiety', 'sadness', 'tired', 'demotivated', 'focused', 'motivated', 'happy', 'energetic', 'neutral'];
        mood = validos.includes(parsed.mood) ? parsed.mood : detectEmotion(text).mood;
      } catch {
        const result = detectEmotion(text);
        mood = result.mood;
      }
    } else {
      const result = detectEmotion(text);
      mood = result.mood;
    }
    const moodColor = getMoodColor(mood);
    const moodEntry = { mood, timestamp: Date.now() };
    set((s) => ({
      currentMood: mood,
      moodColor,
      moodHistory: [...s.moodHistory.slice(-23), moodEntry],
    }));
    get().recalcSSC();
    get().regeneratePlan();
    return mood;
  },

  setMood: (mood) => {
    const moodColor = getMoodColor(mood);
    set((s) => ({
      currentMood: mood,
      moodColor,
      moodHistory: [...s.moodHistory.slice(-23), { mood, timestamp: Date.now() }],
    }));
    get().recalcSSC();
    get().regeneratePlan();
  },

  addChatMessage: (msg, conversaIdArg) => {
    // conversaId capturado no envio: se o aluno trocou de thread durante o
    // await da IA, a resposta é salva na thread de origem (banco) em vez de
    // cair na thread nova — e a tela atual não é poluída.
    const conversaId = conversaIdArg !== undefined ? conversaIdArg : get().conversaAtivaId;
    const aindaNaMesma = conversaId === get().conversaAtivaId;
    if (aindaNaMesma) {
      set((s) => ({ chatMessages: [...s.chatMessages, msg] }));
    }
    /* Salvamento silencioso de proposito: a mensagem fica na tela e o app
       tenta gravar em segundo plano, sem toast. O aviso antigo aparecia
       toda hora e era so ruido. */
    supabaseRepository.saveChatMessage(msg, conversaId).catch(() => {});
    /*
     * Titulo automatico: a primeira mensagem do aluno batiza a thread
     * ("Nova conversa" vira o assunto). Silencioso e best-effort.
     */
    if (msg.role === 'user' && conversaId && !conversaId.startsWith('tmp_')) {
      const conv = get().conversas.find((c) => c.id === conversaId);
      const soSaudacao = get().chatMessages.filter((m) => m.role === 'user').length <= 1;
      if (conv && conv.titulo === 'Nova conversa' && soSaudacao) {
        const titulo = msg.text.trim().slice(0, 42) || 'Nova conversa';
        set((s) => ({
          conversas: s.conversas.map((c) => (c.id === conversaId ? { ...c, titulo } : c)),
        }));
        supabaseRepository.renameConversa(conversaId, titulo).catch(() => {});
      }
    }
  },

  setConversas: (conversas) => set({ conversas }),

  novaConversa: async () => {
    // Online: espera o id definitivo para as mensagens ja nascerem
    // amarradas. Offline: thread so-local (tmp_) que nao quebra nada.
    let conversa: Conversa = {
      id: `tmp_${Date.now()}`,
      titulo: 'Nova conversa',
      modo: 'enem_geral',
      criadoEm: Date.now(),
    };
    try {
      const salva = await supabaseRepository.createConversa();
      if (salva) conversa = salva;
    } catch {
      /* offline: segue local, avisa sem travar */
      get().setToast('Sem conexão: a conversa fica só neste aparelho.', 'info');
    }
    set((s) => ({
      conversas: [conversa, ...s.conversas],
      conversaAtivaId: conversa.id,
      chatMessages: [],
    }));
  },

  selecionarConversa: async (id) => {
    if (get().conversaAtivaId === id) return;
    set({ conversaAtivaId: id, chatMessages: [] });
    if (!id) return;
    try {
      const msgs = await supabaseRepository.loadChat(100, id);
      // Troca rapida de thread: so aplica se ainda for a ativa.
      if (get().conversaAtivaId === id) set({ chatMessages: msgs });
    } catch {
      get().setToast('Não foi possível carregar a conversa.', 'error');
    }
  },

  apagarConversa: async (id) => {
    const { conversas, conversaAtivaId } = get();
    try {
      await supabaseRepository.deleteConversa(id);
    } catch {
      get().setToast('Não foi possível apagar a conversa.', 'error');
      return;
    }
    const restantes = conversas.filter((c) => c.id !== id);
    set({ conversas: restantes });
    get().setToast('Conversa apagada.', 'info');
    if (conversaAtivaId === id) {
      // Abre a mais recente; sem nenhuma, tela limpa (a saudacao do
      // ChatPage assume sozinha).
      await get().selecionarConversa(restantes[0]?.id ?? null);
    }
  },

  /**
   * Feedback OTIMISTA de XP. Nao grava nada no servidor.
   *
   * Em todo o app, addXP(n) e sempre seguido de addLog({..., xp: n}) com o
   * mesmo valor. Como registrar_xp() no banco grava log e XP juntos, se os
   * dois metodos escrevessem o XP entraria em dobro. Entao: addXP so pinta
   * a tela na hora, addLog e quem persiste, e a resposta do servidor
   * sobrescreve este palpite.
   */
  addXP: (n) => {
    set((s) => {
      const newXp = Math.max(0, s.gamification.xp + n);
      const { level } = calcLevel(newXp);
      const leveledUp = level > s.gamification.level;
      return {
        gamification: { ...s.gamification, xp: newXp, level },
        toastMessage: leveledUp ? `Level Up! Agora você é nível ${level}!` : `+${n} XP`,
        toastType: leveledUp ? 'success' : 'info',
      };
    });
  },

  /**
   * Registra o evento no servidor. O XP volta calculado pelo banco (com
   * teto por evento, nivel e streak), entao o retorno SUBSTITUI o estado
   * local em vez de somar.
   */
  addLog: (entry) => {
    set((s) => ({ logs: [...s.logs, entry] }));

    const xp = entry.xp ?? 0;
    // XP negativo (compra na loja) nao passa por aqui: registrar_xp so
    // soma. A loja usa a RPC comprar_item, que debita no servidor.
    if (xp < 0) return;

    /*
     * O XP e o servidor que decide, mas o aviso "+10 XP" ja apareceu na
     * tela quando addXP rodou. Se a gravacao falhar, o aluno viu um ganho
     * que nao existe e vai estranhar o numero menor no proximo acesso.
     * Nao da para desfazer sem piorar (tirar XP da tela parece punicao),
     * entao o minimo honesto e contar o que aconteceu.
     */
    persistir(
      supabaseRepository.registrarXp(entry.type, entry.description, xp).then((g) => {
        /* Pela updateGamification: o nivel e SEMPRE recalculado do XP via
           calcLevel, nunca confiado no campo level do servidor (a formula
           plana antiga da migration 003 ainda pode estar valendo no banco
           de quem nao rodou a 008). */
        if (g) get().updateGamification(g);
      }),
      { mensagem: 'Este XP nao foi registrado. Ele nao vai contar no seu total.' },
    );
  },

  setDailyPlan: (plan) => set({ dailyPlan: plan }),

  /**
   * Conclui uma tarefa do Plano do Dia.
   *
   * A versao anterior tinha DUAS falhas que juntas davam XP infinito:
   *
   *   1. Lia o estado DEPOIS de inverter o checkbox, entao a condicao
   *      `!task.completed` premiava a transicao errada.
   *   2. Nada impedia marcar e desmarcar em loop; cada ciclo creditava
   *      20 XP de novo.
   *
   * Agora quem decide e o servidor: concluir_tarefa() so paga se aquela
   * tarefa ainda nao tinha pago, com a linha do plano travada. E a tarefa
   * nao volta atras, que e o padrao de meta diaria e elimina a classe
   * inteira do problema.
   */
  completeTask: (taskId) => {
    const plano = get().dailyPlan;
    const tarefa = plano?.tasks.find((t) => t.id === taskId);
    if (!plano || !tarefa || tarefa.completed) return; // ja concluida: nada a fazer

    // Otimista: marca na hora para o toque parecer instantaneo.
    set((s) =>
      s.dailyPlan
        ? {
            dailyPlan: {
              ...s.dailyPlan,
              tasks: s.dailyPlan.tasks.map((t) => (t.id === taskId ? { ...t, completed: true } : t)),
            },
          }
        : s,
    );
    get().addXP(XP_PER_TASK); // so pinta a tela; o servidor tem a palavra final

    supabaseRepository
      .concluirTarefa(plano.date, taskId)
      .then((g) => {
        if (g) get().updateGamification(g);
      })
      .catch(() => {
        // servidor recusou: desfaz a marcacao para nao mentir ao aluno
        set((s) =>
          s.dailyPlan
            ? {
                dailyPlan: {
                  ...s.dailyPlan,
                  tasks: s.dailyPlan.tasks.map((t) => (t.id === taskId ? { ...t, completed: false } : t)),
                },
              }
            : s,
        );
      });
  },

  regeneratePlan: () => {
    if (get().dailyPlan?.date === getToday()) return; // ja existe plano de hoje
    const dailyPlan: DailyPlan = { date: getToday(), ...generatePlan(get().currentMood) };
    set({ dailyPlan });
    persistir(supabaseRepository.savePlano(dailyPlan), {
      mensagem: 'O plano de hoje nao foi salvo. Ele pode mudar ao recarregar.',
    });
  },

  setToast: (message, type = 'info') => set({ toastMessage: message, toastType: type }),
  clearToast: () => set({ toastMessage: null }),


  setShowCrisisOverlay: (v) => set({ showCrisisOverlay: v }),
  setShowWeeklyReport: (v) => set({ showWeeklyReport: v }),
  setShowNotebookStudio: (v) => set({ showNotebookStudio: v }),
  setShowTutorial: (v) => set({ showTutorial: v }),
  setTutorialStep: (n) => set({ tutorialStep: n }),
  setPersonas: (personas) => set({ personas }),
  addPersona: (persona) => {
    // Grava primeiro: o id definitivo vem do banco, o local e provisorio.
    supabaseRepository
      .savePersona(persona)
      .then((salva) => set((s) => ({ personas: [...s.personas, salva ?? persona] })))
      .catch(() => set((s) => ({ personas: [...s.personas, persona] })));
  },
  removePersona: (id) => {
    const anterior = get().personas;
    const personaAtivaAntes = get().activePersonaId;
    set((s) => ({
      personas: s.personas.filter((p) => p.id !== id),
      activePersonaId: s.activePersonaId === id ? 'mentor_enem' : s.activePersonaId,
    }));
    persistir(supabaseRepository.deletePersona(id), {
      aoFalhar: () => set({ personas: anterior, activePersonaId: personaAtivaAntes }),
      mensagem: 'Nao foi possivel apagar o professor. Ele continua na sua lista.',
    });
  },
  setActivePersonaId: (id) => {
    set({ activePersonaId: id });
    /*
     * Silencio proposital: guarda apenas qual professor estava selecionado.
     * Falhar significa reabrir no professor padrao, sem perda de conteudo.
     */
    /*
     * O id vai como TEXTO.
     *
     * A coluna era bigint e os professores embutidos tem id em texto
     * ('prof_matematica'), entao o teste numerico gravava null: escolher
     * o professor de matematica nunca sobrevivia a um F5, e o aluno
     * voltava para o Mentor geral sem entender por que. A migracao 012
     * troca a coluna para text.
     */
    supabaseRepository.savePreferencias({ persona_ativa_id: id }).catch(() => {});
  },
  setShowPersonaManager: (v) => set({ showPersonaManager: v }),
  setApiKey: (key) => {
    safeSet('mm_api_key', key);
    set({ apiKey: key });
  },
  setIsMuted: (v) => set({ isMuted: v }),

  setLastCorrection: (c) => set({ lastCorrection: c }),
  addQuizResult: (r) => {
    set((s) => ({ quizResults: [...s.quizResults, r] }));
    /*
     * Nao desfaz: o resultado ja e do aluno e apaga-lo da tela seria
     * apagar o que ele acabou de conquistar. O XP vai por addLog, que tem
     * o proprio caminho no servidor; o que se perde aqui e o historico.
     */
    persistir(supabaseRepository.saveQuizResult(r), {
      mensagem: 'O resultado do quiz nao entrou no seu historico.',
    });
  },
  setNotas: (notas) => set({ notas }),
  addNota: (nota) => {
    set((s) => ({ notas: [nota, ...s.notas] }));
    // Troca o id provisorio pelo definitivo do banco, senao apagar a nota
    // recem-criada falharia (o delete usa o id).
    /*
     * Se a gravacao falhar, a anotacao fica so na tela com id provisorio:
     * some no proximo carregamento e o aluno perde o que escreveu sem
     * nenhum sinal. Aqui ela sai da lista e o texto e devolvido no aviso,
     * para dar chance de copiar antes de tentar de novo.
     */
    persistir(
      supabaseRepository.saveNota(nota).then((salva) => {
        if (salva) set((s) => ({ notas: s.notas.map((n) => (n.id === nota.id ? salva : n)) }));
      }),
      {
        aoFalhar: () => set((s) => ({ notas: s.notas.filter((n) => n.id !== nota.id) })),
        mensagem: 'A anotacao nao foi salva. Copie o texto e tente de novo.',
      },
    );
  },
  updateGamification: (g) =>
    set((s) => {
      const merged = { ...s.gamification, ...g };
      if (g.xp !== undefined) {
        const { level } = calcLevel(merged.xp);
        merged.level = level;
      }
      return { gamification: merged };
    }),
  setChatMessages: (msgs) => set({ chatMessages: msgs }),
  setLogs: (logs) => set({ logs }),

  addChallengeResult: (r) => {
    set((s) => ({ challengeResults: [r, ...s.challengeResults].slice(0, 20) }));
    persistir(supabaseRepository.saveDesafio(r), {
      mensagem: 'A correcao nao entrou no seu historico de redacoes.',
    });
    get().addLog({
      timestamp: r.timestamp,
      type: 'essay',
      description: `Desafio concluído: ${r.tema} - ${r.notaFinal}/1000`,
      xp: r.xpGanho,
    });
  },

  setChallengeSeenTutorial: (v) => {
    set({ challengeSeenTutorial: v });
    /*
     * Silencio proposital: isto so marca que o tutorial ja foi visto. Se
     * falhar, o pior que acontece e o tutorial reaparecer uma vez. Avisar
     * o aluno sobre isso seria ruido, nao informacao.
     */
    supabaseRepository.savePreferencias({ desafio_tutorial: v }).catch(() => {});
  },
}));

/**
 * Executa uma gravacao no banco avisando o aluno quando ela falha.
 *
 * O padrao anterior era `.catch(() => {})` em 13 pontos. Como a interface
 * atualiza de forma otimista, o efeito pratico era este: a anotacao sumia
 * da tela, a exclusao falhava, e ao recarregar a anotacao voltava. O aluno
 * achava que tinha apagado. O mesmo valia para editar anotacao, concluir
 * sessao de foco e entrar em liga.
 *
 * Aqui a falha faz duas coisas: desfaz a mudanca otimista (quando o
 * chamador diz como) e mostra uma mensagem dizendo o que de fato aconteceu
 * com o dado. Sem o desfazer, a tela continuaria mentindo mesmo com aviso.
 *
 * Nao serve para gravacao sem consequencia visivel (marcar tutorial como
 * visto, por exemplo): ali o aviso seria ruido.
 */
export function persistir<T>(
  promessa: Promise<T>,
  opcoes: {
    /** Desfaz a alteracao otimista. Sem isso, a tela segue mostrando o que nao foi salvo. */
    aoFalhar?: () => void;
    /** Mensagem especifica. O padrao serve para qualquer gravacao. */
    mensagem?: string;
  } = {},
): void {
  promessa.catch(() => {
    opcoes.aoFalhar?.();
    useAppStore
      .getState()
      .setToast(
        opcoes.mensagem ?? 'Não foi possível salvar. Verifique sua conexão e tente de novo.',
        'error',
      );
  });
}
