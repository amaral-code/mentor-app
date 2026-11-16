import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LazyMotion } from 'motion/react';
import { useAppStore, persistir } from '@mentor/state/appStore';
import { carregarDadosDoUsuario } from '@mentor/state/carregarDados';
import { userRepository } from '@mentor/api/UserRepository';
import { comTimeout, TIMEOUT_BOOT_MS } from '@mentor/core/comTimeout';
import { safeGet } from '@mentor/core/safeStorage';
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
const ProfessorPage = lazy(() =>
  import('./features/educator/ProfessorPage').then((m) => ({ default: m.ProfessorPage })),
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
import { precisaOnboarding } from '@mentor/core/onboardingLocal';
import { OnboardingTour } from './shared/ui/OnboardingTour';
import { LevelUpOverlay } from './shared/ui/LevelUpOverlay';
import { mascotStore } from '@mentor/state/mascotStore';
import { getToday, proximoStreak } from '@mentor/core/utils';

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
import { hidratarCache } from '@mentor/api/rankingEngine';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { deveGerarRelatorio } from '@mentor/core/decompressionReport';

export default function App() {
  // Seletores atomicos: o App monta TODAS as telas; assinar o store inteiro
  // aqui re-renderizava a arvore toda a cada mensagem, toast ou XP.
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const userRole = useAppStore((s) => s.userRole);
  const setSession = useAppStore((s) => s.setSession);
  const updateGamification = useAppStore((s) => s.updateGamification);
  const setApiKey = useAppStore((s) => s.setApiKey);
  // Fatia de gamificacao (nao o store): os efeitos de streak/level abaixo
  // precisam dela, e ela so muda em ganho de XP — nao a cada mensagem.
  const gamification = useAppStore((s) => s.gamification);
  const session = useAppStore((s) => s.session);
  // Assinatura minima do store de bem-estar: so o que dispara o efeito
  // do relatorio semanal, para nao re-renderizar o App a cada telemetria.
  const relatoriosCarregados = useBemEstarStore((s) => s.carregado);
  const prevLevel = useRef(gamification.level);
  /* Qual usuario ja teve os dados carregados. Evita refazer o boot a
     cada TOKEN_REFRESHED (ou seja, a cada volta para a aba). */
  const uidCarregadoRef = useRef<string | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  /**
   * Sessao + dados do usuario.
   *
   * A sessao vem do JWT (onAuthChange), nao mais de um objeto no
   * localStorage. Isso cobre tres casos que antes ficavam de fora: token
   * expirado, logout em outra aba e refresh automatico.
   */
  useEffect(() => {
    /* A carga em si vive em @mentor/state/carregarDados: o celular faz
       a mesma, e duas copias divergiriam na primeira tabela nova. */
    const carregarDados = carregarDadosDoUsuario;

    // Sessao ja existente (F5 na pagina). getSession nunca joga (timeout
    // interno vira null = tela de login), entao este then e seguro.
    userRepository.getSession().then((s) => {
      if (s) {
        uidCarregadoRef.current = s.uid;
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

    /*
     * Login/logout/refresh, inclusive vindos de outra aba.
     *
     * SO REAGE A TROCA DE USUARIO.
     *
     * O Supabase dispara este callback tambem em TOKEN_REFRESHED, que
     * acontece sozinho e, na pratica, toda vez que a aba volta a ter
     * foco. Sem o guarda de uid, cada volta para a aba custava:
     *
     *   1. as 11 consultas do boot outra vez, sem nada ter mudado;
     *   2. um setSession com o perfil relido do banco - que SOBRESCREVIA
     *      o estado local. Era isso que devolvia o aluno ao wizard de
     *      onboarding quando o banco nao conseguia guardar a flag.
     *
     * Mesmo usuario = nada mudou = nada a refazer. Trocou de usuario
     * (login, logout, outra conta em outra aba), recarrega tudo.
     */
    const cancelar = userRepository.onAuthChange((s) => {
      const uidNovo = s?.uid ?? null;
      if (uidNovo !== null && uidNovo === uidCarregadoRef.current) return;
      uidCarregadoRef.current = uidNovo;

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
    // padrao do build (VITE_GEMINI_API_KEY). Este e o unico VITE_* de
    // chave que sobrou: e a chave PESSOAL do usuario para o modo Gemini
    // direto, sem back-end. A chave do servidor (GEMINI_API_KEY, sem
    // prefixo) vive so dentro de /api e nunca chega aqui. Sem nenhuma, a
    // correcao de redacao pede a chave em vez de falhar muda.
    const savedApiKey = safeGet('mm_api_key');
    const envApiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
    if (savedApiKey) setApiKey(savedApiKey);
    else if (envApiKey) setApiKey(envApiKey);
  }, []);

  /*
   * Streak diário (só aluno).
   *
   * As dependências precisam incluir os campos LIDOS. Sem elas o efeito
   * rodava uma única vez, no instante em que `isAuthenticated` vira true —
   * ou seja, ANTES de `carregarDados` trazer a gamificação do servidor.
   * Como o padrão de `lastAccessDate` já é hoje, a comparação dava igual,
   * o efeito não fazia nada e nunca mais rodava: o streak jamais avançava
   * de um dia para o outro, por mais que o aluno entrasse todo dia.
   *
   * Com as deps, o efeito roda de novo quando o valor real chega e faz a
   * conta certa. Não há laço: a gravação deixa `lastAccessDate` igual a
   * hoje, e a reexecução seguinte cai no `if` e para.
   */
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'student') return;
    const today = getToday();
    const lastAccess = gamification.lastAccessDate;
    if (lastAccess === today) return;

    updateGamification({
      lastAccessDate: today,
      streak: proximoStreak(lastAccess, gamification.streak),
    });
  }, [isAuthenticated, userRole, gamification.lastAccessDate, gamification.streak, updateGamification]);

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
  // Só para estudante: ver `precisaOnboarding`.
  if (precisaOnboarding(session)) {
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
          {/* Secretaria e professor tinham a MESMA tela. O professor via
              upload de planilha de matricula e troca de codigo, coisas
              que o servidor nem deixa ele fazer. Cada um tem a sua. */}
          {userRole === 'teacher' ? <ProfessorPage /> : <EducatorPage />}
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
