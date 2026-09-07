import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { BarChart3, BookMarked, CalendarDays, CalendarHeart, ChevronLeft, Headphones, House, LogOut, Menu, NotebookPen, PenLine, ShieldCheck, ShoppingBag, Target, Timer, Trophy, User, Users, X } from 'lucide-react';
import { MoonLogo } from '../shared/ui/MoonLogo';
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
import { AnimatedNumber, BarraProgresso } from '../shared/ui/AnimatedNumber';
import { pageEnter } from '../shared/lib/motionPresets';

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

/* Cartao do mascote (code.html): gradiente, avatar com respiro, selo
   Ativo com ping e seta. Clicavel: abre o Mentor. */
function MascotCard({ onOpen, reduzida }: { onOpen: () => void; reduzida?: boolean }) {
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      aria-label="Abrir Sagui Assistente"
      title="Sagui Assistente"
      className={`group relative rounded-2xl bg-gradient-to-r from-midnight-800/90 to-midnight-850 border border-white/10 hover:border-emerald-500/40 hover:shadow-[0_0_20px_-3px_rgba(16,185,129,0.25)] transition-all duration-300 shadow-md cursor-pointer ${reduzida ? 'p-1.5' : 'p-2.5'}`}
    >
      <div className={`flex items-center ${reduzida ? 'justify-center' : 'gap-2.5'}`}>
        <div className="relative shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-midnight-700/80 ring-2 ring-emerald-500/30">
          <img
            alt="Sagui Mascote Feliz Pulando"
            className="w-full h-full object-cover object-top scale-110 animate-mascot-breathe"
            src="/assets/ele_feliz_pulando.png"
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-midnight-900 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        </div>
        {!reduzida && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
              Sagui Assistente
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/15 font-semibold px-1.5 py-0.5 rounded-full border border-emerald-500/25">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Ativo
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">Pergunte sobre a prova...</p>
        </div>
        )}
        {!reduzida && (
        <span
          aria-hidden="true"
          className="text-slate-400 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5 p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </span>
        )}
      </div>
    </div>
  );
}

/*
 * Lista de navegacao com seguidor amarelo medido (code.html:
 * #sidebarFollower). A pílula e um elemento absoluto cujo top/height
 * acompanham o item ativo via getBoundingClientRect - traducao direta
 * do vanilla (updateSidebarFollower) para estado React. Recalcula na
 * troca de aba, no resize e no scroll da lista.
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

  const atualizarSeguidor = useCallback(() => {
    const wrap = wrapRef.current;
    const el = itemRefs.current.get(activeTab);
    if (!wrap || !el) return;
    const wrapRect = wrap.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();
    setFollower({ top: itemRect.top - wrapRect.top, height: itemRect.height, opacity: 1 });
  }, [activeTab]);

  useLayoutEffect(() => {
    const t = window.setTimeout(atualizarSeguidor, 120);
    window.addEventListener('resize', atualizarSeguidor);
    const nav = navRef.current;
    nav?.addEventListener('scroll', atualizarSeguidor);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', atualizarSeguidor);
      nav?.removeEventListener('scroll', atualizarSeguidor);
    };
  }, [atualizarSeguidor]);

  return (
    <div className="relative px-3 py-1" ref={wrapRef}>
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
        className="space-y-0.5 overflow-y-auto max-h-[calc(100vh-270px)] md:max-h-[calc(100vh-250px)] relative z-10 hide-scrollbar"
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
              className={`sidebar-link nav-item flex items-center px-4 py-3 rounded-xl text-sm font-medium group cursor-pointer transition-colors ${
                compacta ? 'justify-center px-2' : 'justify-between'
              } ${
                ativa ? 'active-nav text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Icon
                  size={20}
                  className={ativa ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400 transition-colors'}
                />
                {!compacta && <span className="tracking-tight sidebar-label">{tab.label}</span>}
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* Rodape de gamificacao (code.html): card, nivel mono e barra com
   shimmer interno animado. */
function XpFooter({ level, remainder, xpForNext, progresso, compacto }: { level: number; remainder: number; xpForNext: number; progresso: number; compacto?: boolean }) {
  if (compacto) {
    return (
      <div className="p-2 border-t border-white/5 bg-midnight-950/50 flex justify-center">
        <span
          title={`Nv. ${level} Aspirante: ${remainder} / ${xpForNext} XP`}
          className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-[11px] flex items-center justify-center tabular-nums"
        >
          {level}
        </span>
      </div>
    );
  }
  return (
    <div className="p-3 border-t border-white/5 bg-midnight-950/50">
      <div className="bg-midnight-800/80 rounded-xl p-2.5 border border-white/5 space-y-1.5 hover:border-amber-500/30 transition-colors">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300">Nv. {level} Aspirante</span>
          <span className="text-amber-400 font-mono font-medium tabular-nums">
            <AnimatedNumber value={remainder} /> / {xpForNext} XP
          </span>
        </div>
        <div className="w-full h-1.5 bg-midnight-950 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full shadow-glow-amber-sm relative overflow-hidden transition-[width] duration-500"
            style={{ width: `${progresso}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-xp-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { activeTab, setActiveTab, session, logout, gamification } = useAppStore();
  const { level, remainder } = calcLevel(gamification.xp);
  const xpForNext = 100 * level;
  const progresso = Math.min(100, (remainder / xpForNext) * 100);

  /* Drawer do mobile (spec v2.4): menu lateral retratil. */
  const [drawerAberto, setDrawerAberto] = useState(false);
  /* Sidebar retrátil no desktop (protótipo AGcode: #sidebarNav.collapsed). */
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

  // Esc fecha o menu, e o scroll do fundo trava enquanto ele esta aberto.
  useEffect(() => {
    if (!drawerAberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerAberto(false); };
    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [drawerAberto]);

  /* Tour guiado no celular: o OnboardingTour pede para abrir o menu quando
     o passo precisa destacar um botão e o drawer está fechado (sem alvo
     visível o destaque sumia). No desktop o drawer não existe, então ignora. */
  useEffect(() => {
    const aoPedirMenu = (e: Event) => {
      if (window.innerWidth >= 768) return;
      setDrawerAberto((e as CustomEvent<{ open: boolean }>).detail?.open === true);
    };
    window.addEventListener('mm:tour-menu', aoPedirMenu);
    return () => window.removeEventListener('mm:tour-menu', aoPedirMenu);
  }, []);

  function irPara(id: TabId) {
    setActiveTab(id);
    setDrawerAberto(false);
  }

  function renderPage() {
    switch (activeTab) {
      case 'dashboard': return <DashboardPage />;
      case 'chat': return <ChatPage />;
      case 'essay': return <EssayPage />;
      case 'notebook': return <NotebookPage />;
      case 'quiz': return <QuizPage />;
      case 'estatisticas': return <EstatisticasPage />;
      case 'profile': return <ProfilePage />;
      case 'ranking': return <RankingPage />;
      case 'foco': return <FocoPage />;
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
  }

  const inicial = session?.nome?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen flex relative">
      {/* Pular para o conteúdo: navegação por teclado e leitor de tela
          pulam a sidebar/bottom-nav e caem direto na página. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-amber-500 focus:text-midnight-950 focus:font-bold focus:text-sm"
      >
        Pular para o conteúdo
      </a>
      {/* ============================================================
          Sidebar completa (code.html: w-72 mobile / w-60 md / w-64 lg).
          No mobile ela inicia fora da tela e o drawer a revela.
          ============================================================ */}
      <aside
        id="sidebarNav"
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 bg-midnight-900/85 backdrop-blur-2xl border-r border-white/10 select-none transition-all duration-300 ${
          sidebarColapsada ? 'collapsed w-[72px] min-w-[72px]' : 'w-60 lg:w-64'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0 justify-between">
          <div className={`flex items-center border-b border-white/5 ${sidebarColapsada ? 'flex-col gap-2 p-2' : 'justify-between p-3.5 md:p-4'}`}>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center p-1 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 shadow-glow-amber animate-moon-pulse cursor-pointer group">
                <MoonLogo className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-300" />
              </div>
              {!sidebarColapsada && (
              <div className="sidebar-label">
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1">
                  Midnight Mentor
                </h1>
                <p className="text-[10px] font-semibold text-amber-400/90 tracking-widest uppercase font-mono">MENTOR ENEM</p>
              </div>
              )}
            </div>
            <button
              id="sidebarToggleBtn"
              onClick={alternarSidebar}
              title={sidebarColapsada ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-label={sidebarColapsada ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-expanded={!sidebarColapsada}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-amber-300 hover:border-amber-500/50 flex items-center justify-center transition-all shrink-0 active:scale-95"
            >
              <span id="sidebarToggleIcon" className={`inline-flex transition-transform duration-300 ${sidebarColapsada ? 'rotate-180' : ''}`}>
                <ChevronLeft size={14} />
              </span>
            </button>
          </div>

          <div className="px-3 pt-3 pb-1.5">
            <MascotCard onOpen={() => irPara('chat')} reduzida={sidebarColapsada} />
          </div>

          <SidebarNav activeTab={activeTab} irPara={irPara} reduzir={reduzir === true} compacta={sidebarColapsada} />

          <XpFooter level={level} remainder={remainder} xpForNext={xpForNext} progresso={progresso} compacto={sidebarColapsada} />

          <div className={`flex items-center gap-3 px-3 py-2.5 glass-light rounded-xl ${sidebarColapsada ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
              {inicial}
            </div>
            {!sidebarColapsada && (
            <div className="flex-1 min-w-0 sidebar-label">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-white truncate">{session?.nome || 'Usuário'}</p>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[8px] text-amber-400 font-medium leading-none">Aluno</span>
              </div>
              <p className="text-[10px] text-gray-500 truncate">{session?.email || ''}</p>
            </div>
            )}
            <button
              onClick={logout}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all press shrink-0"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MobileHeader (code.html): hamburguer, logo da lua, titulos e
          selo online com ping. */}
      <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-midnight-900/90 backdrop-blur-xl border-b border-white/10 z-40 shrink-0 fixed top-0 left-0 right-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Abrir Menu Lateral"
            aria-expanded={drawerAberto}
            onClick={() => setDrawerAberto(true)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-xl flex items-center justify-center p-0.5 animate-moon-pulse">
              <MoonLogo className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block leading-none">Midnight Mentor</span>
              <span className="text-[9px] font-mono tracking-wider text-amber-400 font-semibold uppercase">MENTOR ENEM</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Online
          </span>
        </div>
      </header>

      {/* Orbes + estrelas de fundo (code.html): ficam atras de tudo
          (z-1), com o conteudo acima (z-10). */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="star-particle w-1.5 h-1.5 top-[12%] left-[28%]" style={{ animationDelay: '0s' }} aria-hidden="true" />
      <div className="star-particle w-1 h-1 top-[22%] left-[68%]" style={{ animationDelay: '1.2s' }} aria-hidden="true" />
      <div className="star-particle w-1 h-1 top-[78%] left-[20%]" style={{ animationDelay: '2.4s' }} aria-hidden="true" />
      <div className="star-particle w-1.5 h-1.5 top-[65%] left-[82%]" style={{ animationDelay: '0.8s' }} aria-hidden="true" />
      <div className="star-particle w-1 h-1 top-[40%] left-[48%]" style={{ animationDelay: '1.8s' }} aria-hidden="true" />
      <div className="star-particle w-1.5 h-1.5 top-[88%] left-[55%]" style={{ animationDelay: '3s' }} aria-hidden="true" />

      {/* ============================================================
          Conteudo
          ============================================================ */}
      {/* min-w-0 e o que permite o conteudo encolher.
          Por padrao um flex item tem min-width:auto e se RECUSA a ficar
          menor que o conteudo, entao qualquer bloco largo empurrava a
          pagina inteira e o app passava a rolar de lado, mesmo com
          overflow-x-auto no filho. */}
      <main className={`flex-1 min-w-0 relative z-10 ${sidebarColapsada ? 'md:ml-[72px]' : 'md:ml-60 lg:ml-64'} ${activeTab === 'chat' ? 'px-2 pb-2 pt-20 md:p-3' : 'p-3 md:p-6 lg:p-8 pt-20 md:pt-6 pb-8'}`}>
        <div id="conteudo" tabIndex={-1} className={`${activeTab === 'chat' ? 'max-w-none' : 'max-w-5xl'} mx-auto min-h-[calc(100dvh-3rem)]`}>
          {/* mode="wait": a pagina que sai termina antes de a nova entrar.
              Com as duas ao mesmo tempo o conteudo se sobrepoe e a leitura
              fica confusa. */}
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={activeTab}
              variants={reduzir ? undefined : pageEnter}
              initial={reduzir ? false : 'inicial'}
              animate={reduzir ? undefined : 'animar'}
              exit={reduzir ? undefined : 'sair'}
            >
              <Suspense fallback={<PageSkeleton />}>
                {renderPage()}
              </Suspense>
            </m.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ============================================================
          Mobile: drawer lateral retratil (spec v2.4).
          ============================================================ */}
      <AnimatePresence>
        {drawerAberto && (
          <div className="md:hidden fixed inset-0 z-50">
            <m.button
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerAberto(false)}
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
              aria-label="Menu principal"
              className="absolute left-0 top-0 bottom-0 w-72 bg-midnight-900/95 backdrop-blur-2xl border-r border-white/10 flex flex-col justify-between safe-area-top safe-area-bottom"
              initial={reduzir ? { opacity: 0 } : { x: '-100%' }}
              animate={reduzir ? { opacity: 1 } : { x: 0 }}
              exit={reduzir ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex flex-col">
                <div className="p-3.5 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center p-1 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 shadow-glow-amber animate-moon-pulse">
                      <MoonLogo className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h1 className="text-sm font-bold tracking-tight text-white">Midnight Mentor</h1>
                      <p className="text-[10px] font-semibold text-amber-400/90 tracking-widest uppercase font-mono">MENTOR ENEM</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerAberto(false)}
                    aria-label="Fechar menu"
                    className="text-slate-400 hover:text-white p-1 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="px-3 pt-3 pb-1.5">
                  <MascotCard onOpen={() => irPara('chat')} />
                </div>

                <SidebarNav activeTab={activeTab} irPara={irPara} reduzir={reduzir === true} />
              </div>

              <div className="space-y-2">
                <XpFooter level={level} remainder={remainder} xpForNext={xpForNext} progresso={progresso} />
                <button
                  onClick={() => { setDrawerAberto(false); logout(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 press"
                >
                  <LogOut size={16} />
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
