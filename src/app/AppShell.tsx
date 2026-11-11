import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { BarChart3, BookMarked, CalendarDays, CalendarHeart, ChevronLeft, ChevronRight, Flame, Headphones, House, LayoutGrid, LogOut, NotebookPen, PenLine, ShieldCheck, ShoppingBag, Star, Target, Timer, Trophy, User, Users, UsersRound, X, Zap } from 'lucide-react';
import { MoonLogo } from '../shared/ui/MoonLogo';
import { PainelLateral } from './PainelLateral';
import { useAppStore } from '../stores/appStore';
import { TabId } from '../shared/types';
import { CrisisOverlay } from '../features/overlays/CrisisOverlay';
import { WeeklyReportModal } from '../features/overlays/WeeklyReportModal';
import { NotebookStudioModal } from '../features/overlays/NotebookStudioModal';
import { FocusCompanion } from '../features/foco/FocusCompanion';
import { DoomscrollGuard } from '../shared/ui/DoomscrollGuard';
import { PageSkeleton } from '../shared/ui/Skeleton';
import { calcLevel } from '../shared/lib/utils';
import { safeGet, safeSet } from '../shared/lib/safeStorage';
import { travarRolagem } from '../shared/lib/scrollLock';
import { AnimatedNumber } from '../shared/ui/AnimatedNumber';
import { pageEnter, pageEnterSuave } from '../shared/lib/motionPresets';
import { proximoIndiceFoco } from '../shared/lib/navegacaoAbas';

/*
 * Cada pagina entra por import dinamico.
 *
 * Antes, tudo era importado de forma estatica: abrir a Central baixava
 * junto o Caderno (com mermaid, ~1MB) e o painel de graficos (chart.js).
 * O aluno em 4G pagava por telas que talvez nem abrisse. Agora o codigo de
 * cada aba so viaja quando a aba e aberta.
 */
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ChatPage = lazy(() => import('../features/chat/ChatPage').then(m => ({ default: m.ChatPage })));
const EssayPage = lazy(() => import('../features/essay/EssayPage').then(m => ({ default: m.EssayPage })));
const NotebookPage = lazy(() => import('../features/notebook/NotebookPage').then(m => ({ default: m.NotebookPage })));
const QuizPage = lazy(() => import('../features/quiz/QuizPage').then(m => ({ default: m.QuizPage })));
const EstatisticasPage = lazy(() => import('../features/estatisticas/EstatisticasPage').then(m => ({ default: m.EstatisticasPage })));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const RankingPage = lazy(() => import('../features/ranking/RankingPage').then(m => ({ default: m.RankingPage })));
const FocoPage = lazy(() => import('../features/foco/FocoPage').then(m => ({ default: m.FocoPage })));
const SalaFocoPage = lazy(() => import('../features/sala/SalaFocoPage').then(m => ({ default: m.SalaFocoPage })));
const StudentStore = lazy(() => import('../features/store/StudentStore').then(m => ({ default: m.StudentStore })));
const ComunidadePage = lazy(() => import('../features/comunidade/ComunidadePage').then(m => ({ default: m.ComunidadePage })));
const EscudoPage = lazy(() => import('../features/escudo/EscudoPage').then(m => ({ default: m.EscudoPage })));
const AudioPillsPage = lazy(() => import('../features/audio/AudioPillsPage').then(m => ({ default: m.AudioPillsPage })));
const CalendarioPage = lazy(() => import('../features/calendario/CalendarioPage').then(m => ({ default: m.CalendarioPage })));
const CuidadoPage = lazy(() => import('../features/cuidado/CuidadoPage').then(m => ({ default: m.CuidadoPage })));
/* Rede de Apoio SEM entrada na sidebar do aluno (apoio mora no Painel
   dos Pais). A rota continua existindo para navegação programática:
   "Buscar psicólogo" na Agenda e o aceite de acompanhamento — que por
   desenho só o estudante pode aprovar. */
const AgendaPage = lazy(() => import('../features/agenda/AgendaPage').then(m => ({ default: m.AgendaPage })));

type IconeLucide = typeof House;

interface Aba {
  id: TabId;
  label: string;
  icon: IconeLucide;
}

/* Ordem e selos da navegacao (spec v2.4). Apoio e Ligas sao modulos
   proprios fora do spec e fecham a lista. */
const TABS: Aba[] = [
  { id: 'dashboard', label: 'Central', icon: House },
  { id: 'chat', label: 'Mentor', icon: BookMarked },
  { id: 'essay', label: 'Redação', icon: PenLine },
  { id: 'foco', label: 'Foco', icon: Timer },
  { id: 'sala', label: 'Sala de Foco', icon: UsersRound },
  { id: 'escudo', label: 'Escudo', icon: ShieldCheck },
  { id: 'quiz', label: 'Quiz', icon: Target },
  { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 },
  { id: 'calendario', label: 'Revisões', icon: CalendarDays },
  { id: 'audio', label: 'Áudio', icon: Headphones },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'notebook', label: 'Caderno', icon: NotebookPen },
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'agenda', label: 'Agenda', icon: CalendarHeart },
  { id: 'comunidade', label: 'Ligas', icon: Users },
];

/*
 * Navegação do celular no visual lúdico (como o Duolingo): quatro abas
 * fixas embaixo + "Mais", que abre uma folha com as outras. Nenhuma aba
 * sumiu: as que não cabem na barra moram na folha, com o mesmo `data-tab`
 * que o tour guiado procura.
 */
const ABAS_BARRA: TabId[] = ['dashboard', 'chat', 'quiz', 'comunidade'];
const ABAS_MAIS = TABS.filter((t) => !ABAS_BARRA.includes(t.id));

/* Abas que ganham o painel lateral no computador largo (xl). Ficam de fora o
   Mentor (já tem a coluna do histórico) e a Central (tem coluna própria). */
const ABAS_COM_PAINEL: TabId[] = ['quiz', 'profile', 'ranking', 'comunidade', 'estatisticas', 'calendario', 'essay', 'foco', 'notebook', 'store'];

/* Ofensiva, XP e nível: os três números que o Duolingo deixa sempre à
   vista. Assina a gamificação AQUI dentro, pelo mesmo motivo do XpFooter:
   ganho de XP re-renderiza só estes chips, não a página aberta. */
function ChipsDeStatus({ compacto }: { compacto?: boolean }) {
  const gamification = useAppStore((s) => s.gamification);
  const { level } = calcLevel(gamification.xp);
  const acesa = gamification.streak >= 1;
  return (
    <div className={`flex items-center ${compacto ? 'gap-3' : 'justify-between w-full'}`}>
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-xl" title={`${gamification.streak} dias seguidos de estudo`}>
        <Flame
          size={22}
          className={acesa ? 'text-amber-500 motion-safe:animate-flame' : 'text-slate-300'}
          fill="currentColor"
          aria-hidden="true"
        />
        <span className={`text-base font-black tabular-nums ${acesa ? 'text-amber-600' : 'text-slate-400'}`}>
          <AnimatedNumber value={gamification.streak} />
        </span>
        <span className="sr-only">{gamification.streak === 1 ? 'dia de ofensiva' : 'dias de ofensiva'}</span>
      </span>
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-xl" title={`${gamification.xp} XP no total`}>
        <Zap size={22} className="text-ceu-500" fill="currentColor" aria-hidden="true" />
        <span className="text-base font-black tabular-nums text-ceu-600">
          <AnimatedNumber value={gamification.xp} />
        </span>
        <span className="sr-only">XP</span>
      </span>
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-xl" title={`Nível ${level}`}>
        <Star size={22} className="text-azul-600" fill="currentColor" aria-hidden="true" />
        <span className="sr-only">nível</span>
        <span className="text-base font-black tabular-nums text-azul-600">{level}</span>
      </span>
    </div>
  );
}

/* Marca: lua sobre o quadrado azul-noite, nome em Nunito Black. */
function Marca({ soIcone }: { soIcone?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 rounded-2xl bg-azul-600 shadow-lip-azul flex items-center justify-center p-1.5 shrink-0">
        <MoonLogo className="w-full h-full object-contain" />
      </div>
      {!soIcone && (
        <div className="sidebar-label leading-none">
          <h1 className="text-lg font-black tracking-tight text-azul-600">Midnight Mentor</h1>
          <p className="text-[10px] font-extrabold text-amber-600 tracking-widest uppercase mt-0.5">Mentor ENEM</p>
        </div>
      )}
    </div>
  );
}

/* Cartão do sagui: abre o Mentor. Cartão adesivo com o mascote acenando. */
function MascotCard({ onOpen, reduzida }: { onOpen: () => void; reduzida?: boolean }) {
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      aria-label="Abrir Sagui Assistente"
      title="Sagui Assistente"
      className={`group relative rounded-2xl bg-white border-2 border-slate-200 shadow-lip hover:border-ceu-500 active:translate-y-1 active:shadow-none transition-[border-color,transform] cursor-pointer ${reduzida ? 'p-1.5' : 'p-2.5'}`}
    >
      <div className={`flex items-center ${reduzida ? 'justify-center' : 'gap-2.5'}`}>
        <div className="relative shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-azul-100">
          <img
            alt="Sagui Mascote Feliz Pulando"
            className="w-full h-full object-cover object-top scale-110 animate-mascot-breathe"
            src="/assets/ele_feliz_pulando.png"
            loading="lazy"
            draggable={false}
            onError={(e) => { if (e.currentTarget.src.endsWith('ele_feliz_pulando.png')) e.currentTarget.src = '/assets/sagui_pulando_2.png'; }}
          />
          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
        {!reduzida && (
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-tinta-900 truncate">Sagui Assistente</span>
            <p className="text-xs font-semibold text-slate-500 truncate">Pergunte sobre a prova...</p>
          </div>
        )}
        {!reduzida && <ChevronRight size={18} className="text-slate-400 group-hover:text-ceu-500 shrink-0" aria-hidden="true" />}
      </div>
    </div>
  );
}

/*
 * Lista de navegacao com seguidor medido. A pilula e um elemento absoluto
 * cujo top/height acompanham o item ativo via getBoundingClientRect.
 * Recalcula na troca de aba, no resize e no scroll da lista.
 */
function SidebarNav({
  activeTab,
  irPara,
  reduzir,
  compacta,
}: {
  activeTab: TabId;
  irPara: (id: TabId) => void;
  reduzir: boolean;
  compacta?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const [follower, setFollower] = useState({ top: 0, height: 0, opacity: 0 });

  /* A aba vive num ref para o callback abaixo ficar ESTAVEL. Com ela na
     dependencia, os listeners de resize/scroll eram removidos e
     readicionados a cada troca de aba, sem necessidade. */
  const abaRef = useRef(activeTab);
  abaRef.current = activeTab;

  const atualizarSeguidor = useCallback(() => {
    const wrap = wrapRef.current;
    const el = itemRefs.current.get(abaRef.current);
    if (!wrap || !el) return;
    const wrapRect = wrap.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();
    const top = itemRect.top - wrapRect.top;
    /* Sai cedo quando nada mudou: o ResizeObserver dispara em qualquer
       mudanca de tamanho, e um setState incondicional ali vira laco de
       render. */
    setFollower((ant) =>
      ant.top === top && ant.height === itemRect.height && ant.opacity === 1
        ? ant
        : { top, height: itemRect.height, opacity: 1 },
    );
  }, []);

  /* Medicao SINCRONA, antes da pintura: a posicao certa ja esta no
     primeiro quadro, sem a pilula correr atras do clique. */
  useLayoutEffect(atualizarSeguidor, [activeTab, compacta, atualizarSeguidor]);

  /* A aba ativa pode estar fora da parte visível da lista (telas baixas):
     rola só o necessário para ela aparecer, e a pílula vem junto. */
  useEffect(() => {
    itemRefs.current.get(activeTab)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeTab]);

  useEffect(() => {
    window.addEventListener('resize', atualizarSeguidor);
    const nav = navRef.current;
    nav?.addEventListener('scroll', atualizarSeguidor, { passive: true });

    /* O observador pega o tamanho final de recolher a sidebar sempre,
       sem adivinhar duracao de transicao. */
    const observador =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(atualizarSeguidor) : null;
    if (wrapRef.current) observador?.observe(wrapRef.current);

    return () => {
      window.removeEventListener('resize', atualizarSeguidor);
      nav?.removeEventListener('scroll', atualizarSeguidor);
      observador?.disconnect();
    };
  }, [atualizarSeguidor]);

  /*
   * Teclado: setas movem o foco pela lista, Home/End vao aos extremos.
   *
   * Mantemos `nav` + `aria-current="page"` em vez de role="tablist":
   * cada item troca a PAGINA inteira, entao a semantica honesta e de
   * navegacao, nao de painel de abas.
   */
  function aoTeclar(e: React.KeyboardEvent<HTMLElement>) {
    const botoes = TABS.map((t) => itemRefs.current.get(t.id)).filter(Boolean) as HTMLButtonElement[];
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    const destino = proximoIndiceFoco(e.key, atual, botoes.length);
    /* `null` = tecla que nao nos interessa, ou foco fora da lista: deixa
       a tecla seguir seu caminho normal em vez de engoli-la. */
    if (destino === null) return;
    e.preventDefault();
    botoes[destino]?.focus();
  }

  return (
    <div className="relative px-3 py-1 h-full overflow-hidden" ref={wrapRef}>
      <div
        className="sidebar-follower"
        aria-hidden="true"
        style={{
          transform: `translateY(${follower.top}px)`,
          height: follower.height,
          opacity: follower.opacity,
          transition: reduzir ? 'none' : undefined,
        }}
      />
      <nav
        ref={navRef}
        onKeyDown={aoTeclar}
        aria-label="Navegação principal"
        /* A altura vem do pai (flex-1 min-h-0): a lista rola por dentro e
           nunca invade o rodape de XP, qualquer que seja a altura da tela. */
        className="space-y-1 h-full overflow-y-auto overscroll-contain relative z-10 hide-scrollbar pb-4"
        data-purpose="sidebar-nav"
      >
        {TABS.map((tab) => {
          const ativa = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              ref={(el) => {
                if (el) itemRefs.current.set(tab.id, el);
                else itemRefs.current.delete(tab.id);
              }}
              onClick={() => irPara(tab.id)}
              aria-current={ativa ? 'page' : undefined}
              aria-label={tab.label}
              title={tab.label}
              className={`sidebar-link nav-item w-full flex items-center px-4 py-2.5 rounded-2xl text-[13px] font-extrabold uppercase tracking-wide group cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ceu-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                compacta ? 'justify-center px-2' : ''
              } ${ativa ? 'text-ceu-600' : 'text-slate-500 hover:bg-slate-100 hover:text-tinta-700'}`}
            >
              <span className="flex items-center gap-3.5">
                <Icon
                  size={24}
                  strokeWidth={2.5}
                  className={ativa ? 'text-ceu-500' : 'text-slate-400 group-hover:text-tinta-700 transition-colors'}
                />
                {!compacta && <span className="sidebar-label">{tab.label}</span>}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/*
 * Rodape de gamificacao: ofensiva/XP/nivel e a barra do proximo nivel.
 *
 * ASSINA A GAMIFICACAO AQUI DENTRO, de proposito: assim cada ganho de XP
 * re-renderiza so este rodape, e nao a pagina aberta.
 */
function XpFooter({ compacto }: { compacto?: boolean }) {
  const gamification = useAppStore((s) => s.gamification);
  const { level, remainder } = calcLevel(gamification.xp);
  const xpForNext = 100 * level;
  const progresso = Math.min(100, (remainder / xpForNext) * 100);

  if (compacto) {
    return (
      <div className="p-2 border-t-2 border-slate-100 flex justify-center">
        <span
          title={`Nv. ${level} Aspirante: ${remainder} / ${xpForNext} XP`}
          className="w-10 h-10 rounded-xl bg-azul-600 shadow-lip-azul text-white font-black text-sm flex items-center justify-center tabular-nums"
        >
          {level}
        </span>
      </div>
    );
  }
  return (
    <div className="px-3 pt-3 pb-2 border-t-2 border-slate-100 space-y-2">
      <ChipsDeStatus />
      <div className="rounded-2xl border-2 border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-tinta-900">Nível {level} · Aspirante</span>
          <span className="text-amber-600 font-extrabold tabular-nums">
            <AnimatedNumber value={remainder} /> / {xpForNext} XP
          </span>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-amber-500 rounded-full relative overflow-hidden transition-[width] duration-500"
            style={{ width: `${progresso}%` }}
          >
            <span className="absolute left-1.5 right-1.5 top-[3px] h-[3px] rounded-full bg-white/40" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * Pagina ativa MEMOIZADA.
 *
 * Fora do AppShell e envolta em `memo`: re-render do shell (abrir o
 * drawer, recolher a sidebar, ganhar XP) nao propaga mais para a pagina.
 * Ela so re-renderiza quando a ABA muda, que e a unica coisa que de fato
 * a afeta.
 */
const PaginaAtiva = memo(function PaginaAtiva({ aba }: { aba: TabId }) {
  switch (aba) {
      case 'dashboard': return <DashboardPage />;
      case 'chat': return <ChatPage />;
      case 'essay': return <EssayPage />;
      case 'notebook': return <NotebookPage />;
      case 'quiz': return <QuizPage />;
      case 'estatisticas': return <EstatisticasPage />;
      case 'profile': return <ProfilePage />;
      case 'ranking': return <RankingPage />;
      case 'foco': return <FocoPage />;
      case 'sala': return <SalaFocoPage />;
      case 'store': return <StudentStore />;
      case 'comunidade': return <ComunidadePage />;
      case 'escudo': return <EscudoPage />;
      case 'audio': return <AudioPillsPage />;
      case 'calendario': return <CalendarioPage />;
      case 'cuidado': return <CuidadoPage />;
      case 'agenda': return <AgendaPage />;
      // Aba corrompida (store persistido): tela em branco virava "bug".
      default: return <DashboardPage />;
  }
});

export function AppShell() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);

  /* Folha "Mais" do celular: as abas que não cabem na barra inferior. */
  const [maisAberto, setMaisAberto] = useState(false);
  /* Sidebar retrátil no desktop. */
  const [sidebarColapsada, setSidebarColapsada] = useState(
    () => safeGet('mm_sidebar_collapsed') === '1',
  );
  const reduzir = useReducedMotion();

  function alternarSidebar() {
    setSidebarColapsada((v) => {
      safeSet('mm_sidebar_collapsed', v ? '0' : '1');
      return !v;
    });
  }

  // Esc fecha a folha, e o scroll do fundo trava enquanto ela esta aberta.
  // A trava e CONTADA (scrollLock): um modal aberto por cima tambem trava,
  // e o primeiro a fechar nao destrava a pagina para os dois.
  useEffect(() => {
    if (!maisAberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaisAberto(false); };
    document.addEventListener('keydown', aoTeclar);
    const soltar = travarRolagem();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      soltar();
    };
  }, [maisAberto]);

  /* Tour guiado no celular: o OnboardingTour pede para abrir o menu quando
     o passo destaca uma aba que nao esta visivel (agora, uma aba da folha
     "Mais"). No desktop a sidebar mostra tudo, entao ignora. */
  useEffect(() => {
    const aoPedirMenu = (e: Event) => {
      if (window.innerWidth >= 768) return;
      setMaisAberto((e as CustomEvent<{ open: boolean }>).detail?.open === true);
    };
    window.addEventListener('mm:tour-menu', aoPedirMenu);
    return () => window.removeEventListener('mm:tour-menu', aoPedirMenu);
  }, []);

  function irPara(id: TabId) {
    setActiveTab(id);
    setMaisAberto(false);
  }

  /*
   * Rolagem volta ao topo a cada troca de aba: sem isto, sair do fim do
   * Ranking e abrir o Perfil largava o aluno no meio da pagina nova.
   * `instant`: a rolagem suave brigaria com a animacao de entrada.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  const inicial = session?.nome?.charAt(0)?.toUpperCase() || '?';
  const abaEstaNoMais = !ABAS_BARRA.includes(activeTab);
  const comPainel = ABAS_COM_PAINEL.includes(activeTab);

  /* overflow-x-clip, e nao hidden: hidden cria area de rolagem e quebra o
     `sticky` do seletor de abas de algumas paginas. */
  return (
    <div className="min-h-screen flex relative overflow-x-clip bg-white">
      {/* Pular para o conteúdo: teclado e leitor de tela pulam a navegação. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-azul-600 focus:text-white focus:font-bold focus:text-sm"
      >
        Pular para o conteúdo
      </a>

      {/* ============================================================
          Desktop: barra lateral clara, itens em caixa alta e aba ativa
          em pílula céu (como a navegação do Duolingo no computador).
          ============================================================ */}
      <aside
        id="sidebarNav"
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 bg-white border-r-2 border-slate-100 select-none transition-all duration-300 ${
          sidebarColapsada ? 'collapsed w-[84px] min-w-[84px]' : 'w-64 lg:w-72'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div className={`flex items-center ${sidebarColapsada ? 'flex-col gap-3 px-2 pt-5 pb-3' : 'justify-between px-5 pt-6 pb-4'}`}>
            <Marca soIcone={sidebarColapsada} />
            <button
              id="sidebarToggleBtn"
              onClick={alternarSidebar}
              title={sidebarColapsada ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-label={sidebarColapsada ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-expanded={!sidebarColapsada}
              className="w-8 h-8 rounded-xl border-2 border-slate-200 text-slate-400 hover:text-ceu-600 hover:border-ceu-500 flex items-center justify-center transition-colors shrink-0"
            >
              <span id="sidebarToggleIcon" className={`inline-flex transition-transform duration-300 ${sidebarColapsada ? 'rotate-180' : ''}`}>
                <ChevronLeft size={16} strokeWidth={3} />
              </span>
            </button>
          </div>

          <div className="px-3 pb-3">
            <MascotCard onOpen={() => irPara('chat')} reduzida={sidebarColapsada} />
          </div>

          <div className="flex-1 min-h-0">
            <SidebarNav activeTab={activeTab} irPara={irPara} reduzir={reduzir === true} compacta={sidebarColapsada} />
          </div>

          <XpFooter compacto={sidebarColapsada} />

          <div className={`flex items-center gap-3 px-4 py-3 border-t-2 border-slate-100 ${sidebarColapsada ? 'justify-center px-2' : ''}`}>
            {!sidebarColapsada && (
              <>
                <div className="w-9 h-9 rounded-full bg-ceu-500 text-white flex items-center justify-center font-black text-sm shrink-0">
                  {inicial}
                </div>
                <div className="flex-1 min-w-0 sidebar-label">
                  <p className="text-sm font-extrabold text-tinta-900 truncate">{session?.nome || 'Usuário'}</p>
                  <p className="text-[11px] font-semibold text-slate-500 truncate">{session?.email || ''}</p>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={logout}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors press shrink-0"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================
          Celular: topo com ofensiva, XP e nível (sempre à vista).
          ============================================================ */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b-2 border-slate-100 safe-area-top">
        <div className="h-[60px] flex items-center gap-3 px-3">
          <Marca soIcone />
          <ChipsDeStatus />
        </div>
      </header>

      {/* Mantidos por compatibilidade com o CSS antigo; o tema claro os
          esconde (.orb e .star-particle com display none). */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />

      {/* ============================================================
          Conteudo
          ============================================================ */}
      {/* min-w-0 permite o conteudo encolher: por padrao um flex item se
          recusa a ficar menor que o conteudo e empurra a pagina de lado.

          Respiro do celular: topo (60px + notch) e base (barra inferior de
          72px + barra de gestos do iPhone). Sem somar os insets, o começo e
          o fim de cada página corriam por baixo das barras fixas. */}
      <main
        className={`flex-1 min-w-0 relative z-10 ${sidebarColapsada ? 'md:ml-[84px]' : 'md:ml-64 lg:ml-72'} ${
          activeTab === 'chat'
            ? 'px-2 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:p-3'
            : 'p-3 md:p-6 lg:p-8 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:pt-8 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-10'
        }`}
      >
        <div
          id="conteudo"
          tabIndex={-1}
          className={`${activeTab === 'chat' ? 'max-w-none' : comPainel ? 'max-w-5xl xl:max-w-[1240px] xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8 xl:items-start' : 'max-w-5xl'} mx-auto min-h-[calc(100dvh-3rem)]`}
        >
          <div className="min-w-0">
          {/* Troca de aba nao recarrega a pagina: esta regiao anuncia o nome
              da nova secao ao leitor de tela, sem roubar o foco. */}
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {TABS.find((t) => t.id === activeTab)?.label ?? 'Central'}
          </span>
          {/* mode="wait": a pagina que sai termina antes de a nova entrar. */}
          <AnimatePresence mode="wait" initial={false}>
            {/* Com movimento reduzido a transicao troca de forma (so
                crossfade), em vez de sumir: sem ela, quem pediu menos
                movimento ficava sem pista de que a secao mudou. */}
            <m.div
              key={activeTab}
              variants={reduzir ? pageEnterSuave : pageEnter}
              initial="inicial"
              animate="animar"
              exit="sair"
            >
              <Suspense fallback={<PageSkeleton />}>
                <PaginaAtiva aba={activeTab} />
              </Suspense>
            </m.div>
          </AnimatePresence>
          </div>
          {comPainel && (
            <div className="hidden xl:block self-stretch">
              <PainelLateral aba={activeTab} />
            </div>
          )}
        </div>
      </main>

      {/* ============================================================
          Celular: barra inferior (4 abas + Mais).
          ============================================================ */}
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-100 safe-area-bottom"
      >
        <div className="flex items-stretch justify-between gap-1 px-2 pt-2 pb-2">
          {ABAS_BARRA.map((id) => {
            const tab = TABS.find((t) => t.id === id)!;
            const Icon = tab.icon;
            const ativa = activeTab === id;
            return (
              <button
                key={id}
                data-tab={id}
                onClick={() => irPara(id)}
                aria-current={ativa ? 'page' : undefined}
                className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-colors ${
                  ativa ? 'bg-ceu-100 border-ceu-500 text-ceu-600' : 'border-transparent text-slate-400 active:bg-slate-100'
                }`}
              >
                <Icon size={26} strokeWidth={2.5} aria-hidden="true" />
                <span className="text-[11px] font-extrabold leading-none">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMaisAberto(true)}
            aria-expanded={maisAberto}
            aria-haspopup="dialog"
            aria-label="Mais seções"
            className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition-colors ${
              abaEstaNoMais ? 'bg-ceu-100 border-ceu-500 text-ceu-600' : 'border-transparent text-slate-400 active:bg-slate-100'
            }`}
          >
            <LayoutGrid size={26} strokeWidth={2.5} aria-hidden="true" />
            <span className="text-[11px] font-extrabold leading-none">Mais</span>
          </button>
        </div>
      </nav>

      {/* ============================================================
          Celular: folha "Mais" com as outras seções em ícones grandes.
          ============================================================ */}
      <AnimatePresence>
        {maisAberto && (
          <div className="md:hidden fixed inset-0 z-50">
            <m.button
              className="absolute inset-0 bg-tinta-900/40"
              onClick={() => setMaisAberto(false)}
              aria-label="Fechar menu"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label="Mais seções"
              className="absolute left-0 right-0 bottom-0 max-h-[85dvh] bg-white rounded-t-[28px] border-t-2 border-slate-200 flex flex-col safe-area-bottom"
              initial={reduzir ? { opacity: 0 } : { y: '100%' }}
              animate={reduzir ? { opacity: 1 } : { y: 0 }}
              exit={reduzir ? { opacity: 0 } : { y: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <span className="w-10" aria-hidden="true" />
                <span className="w-12 h-1.5 rounded-full bg-slate-200" aria-hidden="true" />
                <button
                  onClick={() => setMaisAberto(false)}
                  aria-label="Fechar menu"
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-tinta-900"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
                <div className="mb-4">
                  <MascotCard onOpen={() => irPara('chat')} />
                </div>
                <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                  {ABAS_MAIS.map((tab) => {
                    const Icon = tab.icon;
                    const ativa = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        data-tab={tab.id}
                        onClick={() => irPara(tab.id)}
                        aria-current={ativa ? 'page' : undefined}
                        className="flex flex-col items-center gap-1.5 group"
                      >
                        <span
                          className={`w-16 h-[60px] rounded-[18px] flex items-center justify-center transition-transform group-active:translate-y-1 group-active:shadow-none ${
                            ativa ? 'bg-ceu-500 text-white shadow-lip-ceu' : 'bg-azul-100 text-azul-600 shadow-lip'
                          }`}
                        >
                          <Icon size={28} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                        <span className={`text-xs font-bold text-center leading-tight ${ativa ? 'text-ceu-600' : 'text-tinta-900'}`}>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 -mx-1">
                  <XpFooter />
                </div>
                <button
                  onClick={() => { setMaisAberto(false); logout(); }}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-extrabold uppercase tracking-wide text-slate-500 hover:text-red-600 hover:bg-red-50 press"
                >
                  <LogOut size={18} />
                  Sair da conta
                </button>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      <CrisisOverlay />
      <WeeklyReportModal />
      <NotebookStudioModal />
      <FocusCompanion />
      <DoomscrollGuard />
    </div>
  );
}
