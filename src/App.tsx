import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LazyMotion } from 'motion/react';
import { useAppStore, persistir } from './stores/appStore';
import { userRepository } from './shared/storage/UserRepository';
import { supabaseRepository } from './shared/storage/SupabaseRepository';
import { isSupabaseConfigured } from './shared/lib/supabase';
import { comTimeout, TIMEOUT_BOOT_MS } from './shared/lib/comTimeout';
import { safeGet } from './shared/lib/safeStorage';
import { AuthPage } from './features/auth/AuthPage';
import { AppShell } from './app/AppShell';
import { PageSkeleton } from './shared/ui/Skeleton';

/*
 * As telas de educador e responsavel entram por import dinamico.
 *
 * ParentsDashboard carrega chart.js; sendo importado de forma estatica, o
 * grafico viajava no bundle inicial de TODO aluno, que nunca abre essa
 * tela. Agora so quem tem o papel correspondente baixa esse codigo.
 */
const EducatorPage = lazy(() =>
  import('./features/educator/EducatorPage').then((m) => ({ default: m.EducatorPage })),
);
const ParentPage = lazy(() =>
  import('./features/parent/ParentPage').then((m) => ({ default: m.ParentPage })),
);
const PsicologoPage = lazy(() =>
  import('./features/psicologo/PsicologoPage').then((m) => ({ default: m.PsicologoPage })),
);
import { ParticleCanvas } from './features/atmo/ParticleCanvas';
import { TrocarSenha } from './features/auth/TrocarSenha';
import { Toast } from './shared/ui/Toast';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { OnboardingTour } from './shared/ui/OnboardingTour';
import { LevelUpOverlay } from './shared/ui/LevelUpOverlay';
import { mascotStore } from './stores/mascotStore';
import { GamificationState, ChatPersona } from './shared/types';
import { getToday } from './shared/lib/utils';

/*
 * Carregamento tardio das features de animação.
 *
 * O pacote inteiro do motion pesa ~40 kB gzip e entrava no primeiro
 * carregamento, porque o shell anima. Com LazyMotion, o bundle inicial
 * leva só o mínimo e o motor de animação chega depois, sem segurar a
 * primeira pintura. Em troca, os componentes usam <m.div> em vez de
 * <motion.div>: `strict` faz o build reclamar se alguém esquecer.
 *
 * domMax (e não domAnimation) porque usamos layoutId na navegação e
 * `layout` no ranking, que só existem no conjunto completo.
 */
const featuresAnimacao = () => import('motion/react').then((mod) => mod.domMax);
import { useStoreStore } from './stores/storeStore';
import { hidratarCache } from './shared/lib/rankingEngine';
import { useBemEstarStore } from './stores/bemEstarStore';
import { deveGerarRelatorio } from './shared/lib/decompressionReport';

export default function App() {
  // Seletores atomicos: o App monta TODAS as telas; assinar o store inteiro
  // aqui re-renderizava a arvore toda a cada mensagem, toast ou XP.
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const userRole = useAppStore((s) => s.userRole);
  const setSession = useAppStore((s) => s.setSession);
  const updateGamification = useAppStore((s) => s.updateGamification);
  const setLogs = useAppStore((s) => s.setLogs);
  const setNotas = useAppStore((s) => s.setNotas);
  const setChatMessages = useAppStore((s) => s.setChatMessages);
  const setConversas = useAppStore((s) => s.setConversas);
  const setPersonas = useAppStore((s) => s.setPersonas);
  const setActivePersonaId = useAppStore((s) => s.setActivePersonaId);
  const setApiKey = useAppStore((s) => s.setApiKey);
  // Fatia de gamificacao (nao o store): os efeitos de streak/level abaixo
  // precisam dela, e ela so muda em ganho de XP — nao a cada mensagem.
  const gamification = useAppStore((s) => s.gamification);
  const session = useAppStore((s) => s.session);
  const logs = useAppStore((s) => s.logs);
  // Assinatura minima do store de bem-estar: so o que dispara o efeito
  // do relatorio semanal, para nao re-renderizar o App a cada telemetria.
  const relatoriosCarregados = useBemEstarStore((s) => s.carregado);
  const prevLevel = useRef(gamification.level);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  /**
   * Sessao + dados do usuario.
   *
   * A sessao vem do JWT (onAuthChange), nao mais de um objeto no
   * localStorage. Isso cobre tres casos que antes ficavam de fora: token
   * expirado, logout em outra aba e refresh automatico.
   */
  useEffect(() => {
    const PADRAO = ['mentor_enem', 'prof_matematica', 'prof_portugues', 'prof_ciencias', 'prof_humanas'];

    async function carregarDados() {
      // allSettled: se 1 das 11 tabelas falhar, as outras 10 ainda entram na
      // tela — antes um erro isolado zerava o app com cara de "perdi tudo".
      const nomes = ['gam', 'logs', 'notas', 'conversas', 'personas', 'desafios', 'prefs', 'escolas', 'turmas', 'quizzes', 'humor'] as const;
      const resultados = await Promise.allSettled([
        supabaseRepository.loadGamification(),
        supabaseRepository.loadLogs(),
        supabaseRepository.loadNotas(),
        supabaseRepository.loadConversas(),
        supabaseRepository.loadPersonas(),
        supabaseRepository.loadDesafios(),
        supabaseRepository.loadPreferencias(),
        supabaseRepository.loadEscolas(),
        supabaseRepository.loadTurmas(),
        // Faltavam no boot: sem eles o historico de quiz ficava sempre
        // vazio, e por isso o Mentor nunca sabia qual materia retomar.
        supabaseRepository.loadQuizResults(),
        supabaseRepository.loadHumor(),
      ]);
      const valor = <T,>(i: number, padrao: T): T =>
        resultados[i].status === 'fulfilled' ? (resultados[i] as PromiseFulfilledResult<T>).value : padrao;
      const falhas = resultados
        .map((r, i) => (r.status === 'rejected' ? nomes[i] : null))
        .filter(Boolean);
      if (falhas.length > 0) {
        console.warn('[boot] tabelas nao carregadas:', falhas.join(', '));
        useAppStore.getState().setToast(`Alguns dados nao carregaram (${falhas.join(', ')}). O resto esta normal.`, 'info');
      }
      const gam = valor<Awaited<ReturnType<typeof supabaseRepository.loadGamification>>>(0, null);
      const logs = valor(1, useAppStore.getState().logs);
      const notas = valor(2, useAppStore.getState().notas);
      const conversas = valor(3, useAppStore.getState().conversas);
      const personas = valor(4, [] as Awaited<ReturnType<typeof supabaseRepository.loadPersonas>>);
      const desafios = valor(5, useAppStore.getState().challengeResults);
      const prefs = valor<Awaited<ReturnType<typeof supabaseRepository.loadPreferencias>>>(6, null);
      const escolas = valor(7, [] as Awaited<ReturnType<typeof supabaseRepository.loadEscolas>>);
      const turmas = valor(8, [] as Awaited<ReturnType<typeof supabaseRepository.loadTurmas>>);
      const quizzes = valor(9, useAppStore.getState().quizResults);
      const humor = valor(10, [] as Awaited<ReturnType<typeof supabaseRepository.loadHumor>>);

      // Inventario da loja e cache de escolas/turmas ficavam sem carregar:
      // as funcoes existiam, mas nada as chamava. Efeito visivel: item ja
      // comprado voltava a aparecer como disponivel a cada recarga, e o
      // nome da escola do aluno nunca saia dos dados de demonstracao.
      void useStoreStore.getState().carregar();
      // Telemetria, carteira de foco, revisoes e relatorios do modulo de
      // bem-estar. Fora do Promise.all acima porque nenhuma tela do boot
      // depende deles - o dashboard mostra o indice de fadiga quando
      // chegarem.
      void useBemEstarStore.getState().carregarTudo();
      hidratarCache({ escolas, turmas });

      if (gam) updateGamification(gam);
      setLogs(logs);
      setNotas(notas);
      /*
       * Threads do Mentor (016): abre a mais recente; sem nenhuma, cai
       * no fluxo legado (mensagens sem thread). A saudacao do ChatPage
       * assume sozinha quando a thread ativa chega vazia.
       */
      setConversas(conversas);
      const ativa = conversas[0]?.id ?? null;
      setChatMessages(
        ativa ? await supabaseRepository.loadChat(100, ativa) : await supabaseRepository.loadChat(),
      );
      useAppStore.setState({ conversaAtivaId: ativa });
      if (personas.length > 0) {
        const embutidas = useAppStore.getState().personas.filter((p) => PADRAO.includes(p.id));
        setPersonas([...embutidas, ...personas]);
      }
      useAppStore.setState({ challengeResults: desafios, quizResults: quizzes });
      if (humor.length > 0) {
        useAppStore.setState({ moodHistory: humor, currentMood: humor[humor.length - 1].mood });
      }
      if (prefs) {
        useAppStore.setState({
          challengeSeenTutorial: !!prefs.desafio_tutorial,
          isMuted: !!prefs.mudo,
        });
        if (prefs.persona_ativa_id) setActivePersonaId(String(prefs.persona_ativa_id));
      }
      // Tour do aluno: conta nova (ou que nunca completou) cai direto no
      // passo a passo na primeira entrada. Só estudantes: educador, pais
      // e psicólogo têm telas próprias, sem tour. Backup local cobre conta
      // recém-criada sem linha de preferências (ou offline).
      const papel = useAppStore.getState().session?.role;
      const tourVisto = !!prefs?.tutorial_completo || safeGet('mm_tour_visto') === '1';
      if (papel === 'student' && !tourVisto) {
        useAppStore.setState({ showTutorial: true, tutorialStep: 0 });
      }
    }

    // Sessao ja existente (F5 na pagina). getSession nunca joga (timeout
    // interno vira null = tela de login), entao este then e seguro.
    userRepository.getSession().then((s) => {
      if (s) {
        setSession(s);
        /*
         * Se a carga inicial falhar, o app abre com anotacoes, XP e
         * historico vazios: exatamente a aparencia de "perdi tudo". O
         * aviso separa "o servidor nao respondeu" de "voce nao tem nada",
         * que sao conclusoes muito diferentes para quem estuda aqui.
         *
         * Teto de 20s: com a rede pendurada o Promise.allSettled nunca
         * resolve; o timeout rejeita, o toast avisa e a tela segue com o
         * que ja carregou - nunca branca/congelada.
         */
        persistir(comTimeout(carregarDados(), TIMEOUT_BOOT_MS, 'Carregar dados'), {
          mensagem: 'Conexão lenta: mostrando o que já carregou. Recarregue para completar.',
        });
      }
    });

    // Login/logout/refresh, inclusive vindos de outra aba
    const cancelar = userRepository.onAuthChange((s) => {
      setSession(s);
      if (s) {
        hidratarCache({ perfil: { uid: s.uid, nome: s.nome, email: s.email, escolaId: s.escolaId ?? undefined, turmaId: s.turmaId ?? undefined } });
        persistir(comTimeout(carregarDados(), TIMEOUT_BOOT_MS, 'Carregar dados'), {
          mensagem: 'Conexão lenta: mostrando o que já carregou. Recarregue para completar.',
        });
      }
    });
    return cancelar;
  }, []);

  /**
   * Chave da IA: unico dado que continua no localStorage de proposito.
   * E a chave Gemini pessoal do usuario; guardar num banco compartilhado
   * criaria um alvo unico para todas as chaves de todos os alunos.
   */
  useEffect(() => {
    // Precedencia: chave digitada em Perfil > IA (localStorage) vence o
    // padrao do ambiente (VITE_GEMINI_API_KEY no .env). Sem nenhuma, a
    // correcao de redacao pede a chave em vez de falhar muda.
    const savedApiKey = safeGet('mm_api_key');
    const envApiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
    if (savedApiKey) setApiKey(savedApiKey);
    else if (envApiKey) setApiKey(envApiKey);
  }, []);

  // Streak check (only for students)
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'student') return;
    const today = getToday();
    const lastAccess = gamification.lastAccessDate;
    let streak = gamification.streak;
    if (lastAccess !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (lastAccess === yesterdayStr) {
        streak = gamification.streak + 1;
      } else {
        streak = 1;
      }
      updateGamification({ lastAccessDate: today, streak });
    }
  }, [isAuthenticated, userRole]);

  /*
   * Relatorio de descompressao: abre sozinho na sexta.
   *
   * A conferencia usa a ULTIMA semana ja gerada, nao um flag local:
   * assim quem abriu o app no sabado ainda recebe o da semana, e quem
   * ja leu na sexta nao ve o modal de novo a cada recarga.
   */
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'student') return;
    const { relatorios, carregado } = useBemEstarStore.getState();
    if (!carregado) return;
    if (deveGerarRelatorio(relatorios[0]?.semanaInicio ?? null)) {
      useAppStore.getState().setShowWeeklyReport(true);
    }
  }, [isAuthenticated, userRole, relatoriosCarregados]);

  // Mascote: comemora subida de nível
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'student') return;
    if (gamification.level > prevLevel.current) {
      mascotStore
        .getState()
        .setState('success', `Uau! Você subiu para o nível ${gamification.level}! Continue assim!`);
      setLevelUp(gamification.level);
    }
    prevLevel.current = gamification.level;
  }, [gamification.level, isAuthenticated, userRole]);

  // Mascote: celebra streak novo (a partir de 2 dias)
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'student' || gamification.streak < 2) return;
    mascotStore
      .getState()
      .setState('success', `${gamification.streak} dias seguidos de estudo! Seu foco é inspirador!`);
  }, [gamification.streak, isAuthenticated, userRole]);

  /*
   * Gamificacao e logs NAO sao persistidos aqui.
   *
   * Antes, todo render que mudasse o XP reescrevia o estado inteiro no
   * banco - o que tambem significa que o cliente ditava o placar. Agora a
   * escrita acontece de forma pontual, dentro de registrar_xp(), e este
   * componente so exibe.
   */

  if (!isAuthenticated) {
    return (
      <ErrorBoundary nome="login">
        <ParticleCanvas />
        <AuthPage />
      </ErrorBoundary>
    );
  }

  // Conta importada pela secretaria: troca a senha temporária antes de
  // qualquer outra tela. Sem essa trava, a senha que passou pelo email
  // viraria permanente.
  if (session?.deveTrocarSenha) {
    return (
      <ErrorBoundary nome="troca-senha">
        <TrocarSenha />
        <Toast />
      </ErrorBoundary>
    );
  }

  // Primeiro acesso: wizard exclusivo em tela cheia. Sem sidebar, sem
  // painel, sem dados — o recorrente (flag true) cai direto na interface
  // padrão abaixo. A troca de senha vem antes por segurança.
  if (session && !session.onboardingCompleted) {
    return (
      <ErrorBoundary nome="onboarding">
        <OnboardingFlow />
      </ErrorBoundary>
    );
  }

  // Educador (secretaria) e docente usam o painel educacional: códigos,
  // turmas e importação. A importação e a regeneração de códigos são
  // liberadas só para educator/admin (o servidor confere de novo).
  if (userRole === 'educator' || userRole === 'teacher') {
    return (
      <ErrorBoundary nome="educador">
      <LazyMotion features={featuresAnimacao} strict>
        <ParticleCanvas />
        <Suspense
          fallback={
            <div className="p-6">
              <PageSkeleton />
            </div>
          }
        >
          <EducatorPage />
        </Suspense>
        <Toast />
      </LazyMotion>
      </ErrorBoundary>
    );
  }

  if (userRole === 'parent') {
    return (
      <ErrorBoundary nome="responsaveis">
      <LazyMotion features={featuresAnimacao} strict>
        <ParticleCanvas />
        <Suspense
          fallback={
            <div className="p-6">
              <PageSkeleton />
            </div>
          }
        >
          <ParentPage />
        </Suspense>
        <Toast />
      </LazyMotion>
      </ErrorBoundary>
    );
  }

  /*
   * O papel `psychologist` precisa de tela propria: sem este ramo ele
   * cairia no app do aluno - com quiz e ranking, e sem lugar para
   * declarar horario de atendimento.
   */
  if (userRole === 'psychologist') {
    return (
      <ErrorBoundary nome="psicologo">
      <LazyMotion features={featuresAnimacao} strict>
        <ParticleCanvas />
        <Suspense
          fallback={
            <div className="p-6">
              <PageSkeleton />
            </div>
          }
        >
          <PsicologoPage />
        </Suspense>
        <Toast />
      </LazyMotion>
      </ErrorBoundary>
    );
  }

  // Default: student
  return (
    <ErrorBoundary nome="aluno">
    <LazyMotion features={featuresAnimacao} strict>
      <ParticleCanvas />
      <AppShell />
      <Toast />
      <OnboardingTour />
      <LevelUpOverlay open={levelUp !== null} level={levelUp ?? 1} onClose={() => setLevelUp(null)} />
    </LazyMotion>
    </ErrorBoundary>
  );
}
