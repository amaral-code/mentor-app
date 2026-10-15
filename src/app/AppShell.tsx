import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { BarChart3, BookMarked, CalendarDays, CalendarHeart, ChevronLeft, Headphones, House, LogOut, Menu, NotebookPen, PenLine, ShieldCheck, ShoppingBag, Target, Timer, Trophy, User, Users, UsersRound, WifiOff, X } from 'lucide-react';
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
import { travarRolagem } from '../shared/lib/scrollLock';
import { AnimatedNumber } from '../shared/ui/AnimatedNumber';
import { pageEnter, pageEnterSuave } from '../shared/lib/motionPresets';
import { proximoIndiceFoco } from '../shared/lib/navegacaoAbas';
import { GRUPOS_NAVEGACAO, ordemDasAbas } from '../shared/lib/navegacaoGrupos';
import { useConexao } from '../shared/ui/useConexao';

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

/* Rótulo e ícone de cada aba. A ORDEM de exibição e de teclado vem de
   GRUPOS_NAVEGACAO (shared/lib/navegacaoGrupos.ts). */
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

const ABA_POR_ID = new Map(TABS.map((t) => [t.id, t]));
const ORDEM = ordemDasAbas();

/* O cartão "Sagui Assistente · Ativo" que ficava aqui saiu: abria o
   Mentor, que já é o segundo item do menu, e o selo "Ativo" com bolinha
   pulsando não media nada. Dois caminhos para o mesmo lugar, logo acima
   da lista, só empurravam o menu para baixo. */

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

  /*
   * Medicao SINCRONA, antes da pintura.
   *
   * A versao anterior media dentro de um `setTimeout(..., 120)` - o que
   * anulava o proposito do useLayoutEffect e deixava a pilula amarela
   * 120ms na posicao ANTIGA a cada troca de aba. Trocando rapido, ela
   * corria atras do clique o tempo todo. Agora a posicao certa ja esta
   * no primeiro quadro.
   */
  useLayoutEffect(atualizarSeguidor, [activeTab, compacta, atualizarSeguidor]);

  useEffect(() => {
    window.addEventListener('resize', atualizarSeguidor);
    const nav = navRef.current;
    nav?.addEventListener('scroll', atualizarSeguidor, { passive: true });

    /* O timeout de 120ms existia para esperar a transicao de recolher a
       sidebar (300ms - nem dava conta). O observador pega o tamanho
       final sempre, sem adivinhar duracao nenhuma. */
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
   * navegacao, nao de painel de abas. Anunciar "tab" a um leitor de tela
   * prometeria um painel associado que nao existe.
   */
  function aoTeclar(e: React.KeyboardEvent<HTMLElement>) {
    const botoes = ORDEM.map((id) => itemRefs.current.get(id)).filter(Boolean) as HTMLButtonElement[];
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    const destino = proximoIndiceFoco(e.key, atual, botoes.length);
    /* `null` = tecla que nao nos interessa, ou foco fora da lista: deixa
       a tecla seguir seu caminho normal em vez de engoli-la. */
    if (destino === null) return;
    e.preventDefault();
    botoes[destino]?.focus();
  }

  return (
    <div className="relative px-2 py-2 flex-1 min-h-0 flex flex-col overflow-hidden" ref={wrapRef}>
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
        /* A lista ocupa o que sobra entre a marca e o rodapé (flex-1), em
           vez de uma altura calculada à mão: o cálculo antigo cortava os
           últimos itens em telas de 900px e sobrava espaço nas altas. */
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative z-10 hide-scrollbar pb-2"
        data-purpose="sidebar-nav"
      >
        {GRUPOS_NAVEGACAO.map((grupo, gi) => (
          <div key={grupo.rotulo ?? 'inicio'} className={gi > 0 ? 'pt-2.5' : ''}>
            {grupo.rotulo && (compacta ? (
              <div aria-hidden="true" className="mx-3 mb-2 border-t border-linha" />
            ) : (
              <p className="px-3 pb-0.5 text-xs font-medium text-gray-600 sidebar-label">{grupo.rotulo}</p>
            ))}
            {grupo.abas.map((id) => {
              const tab = ABA_POR_ID.get(id);
              if (!tab) return null;
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
                  className={`sidebar-link nav-item w-full flex items-center gap-3 px-3 py-1.5 min-h-[36px] rounded-md text-[0.9375rem] cursor-pointer transition-colors duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    compacta ? 'justify-center px-2' : ''
                  } ${
                    ativa ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon size={18} strokeWidth={ativa ? 2.2 : 1.8} className={ativa ? 'text-amber-400' : 'text-gray-500'} />
                  {!compacta && <span className="sidebar-label">{tab.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

/*
 * Rodapé de gamificação: nível e barra de XP, sem cartão e sem brilho.
 *
 * ASSINA A GAMIFICACAO AQUI DENTRO, de proposito.
 *
 * Antes o AppShell assinava `gamification` para passar o XP por prop.
 * Como e ele quem renderiza a pagina ativa, CADA ganho de XP
 * re-renderizava a arvore inteira - a tela de quiz, o chat, o ranking,
 * tudo - por causa de uma barrinha no rodape da sidebar. Assinando aqui,
 * so este rodape re-renderiza; a pagina aberta nem fica sabendo.
 */
function XpFooter({ compacto }: { compacto?: boolean }) {
  const gamification = useAppStore((s) => s.gamification);
  const { level, remainder } = calcLevel(gamification.xp);
  const xpForNext = 100 * level;
  const progresso = Math.min(100, (remainder / xpForNext) * 100);

  if (compacto) {
    return (
      <div className="p-2 border-t border-linha flex justify-center">
        <span
          title={`Nível ${level}: ${remainder} de ${xpForNext} XP`}
          className="w-9 h-9 rounded-md border border-linha-forte text-amber-400 font-mono font-semibold text-xs flex items-center justify-center tabular-nums"
        >
          {level}
        </span>
      </div>
    );
  }
  return (
    <div className="px-4 py-3 border-t border-linha">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-gray-300">Nível {level}</span>
        <span className="text-gray-500 font-mono tabular-nums">
          <AnimatedNumber value={remainder} /> / {xpForNext} XP
        </span>
      </div>
      <div
        className="mt-1.5 h-1 w-full bg-folha-3 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={`Progresso até o nível ${level + 1}`}
        aria-valuenow={Math.round(progresso)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-amber-500 rounded-full transition-[width] duration-500" style={{ width: `${progresso}%` }} />
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

/* Marca: lua + nome em Literata. "para o ENEM" diz em três palavras o que
   o app é; o antigo "MENTOR ENEM" em mono maiúsculo repetia o nome. */
function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <MoonLogo className="w-7 h-7 shrink-0" />
      {!compacta && (
        <div className="sidebar-label min-w-0">
          <p className="font-display text-base lg:text-[1.0625rem] font-semibold leading-tight text-white whitespace-nowrap">Midnight Mentor</p>
          <p className="text-xs text-gray-500 leading-tight">para o ENEM</p>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);

  /* Drawer do mobile (spec v2.4): menu lateral retratil. */
  const [drawerAberto, setDrawerAberto] = useState(false);
  /* Sidebar retrátil no desktop (protótipo AGcode: #sidebarNav.collapsed). */
  const [sidebarColapsada, setSidebarColapsada] = useState(
    () => safeGet('mm_sidebar_collapsed') === '1',
  );
  const reduzir = useReducedMotion();
  const online = useConexao();

  function alternarSidebar() {
    setSidebarColapsada((v) => {
      safeSet('mm_sidebar_collapsed', v ? '0' : '1');
      return !v;
    });
  }

  // Esc fecha o menu, e o scroll do fundo trava enquanto ele esta aberto.
  // A trava e CONTADA (scrollLock): um modal aberto por cima do drawer
  // tambem trava, e antes o primeiro a fechar destravava a pagina para os
  // dois.
  useEffect(() => {
    if (!drawerAberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerAberto(false); };
    document.addEventListener('keydown', aoTeclar);
    const soltar = travarRolagem();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      soltar();
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

  /*
   * Rolagem volta ao topo a cada troca de aba.
   *
   * Sem isto, sair do fim do Ranking e abrir o Perfil largava o aluno no
   * meio da pagina nova, sem cabecalho a vista - parecia que a tela
   * abriu quebrada.
   *
   * `instant`: a rolagem suave, aqui, brigaria com a animacao de entrada
   * da pagina e produziria um deslize duplo.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

    /* overflow-x-clip: guarda contra qualquer bloco largo que faça a
     página deslizar para o lado no celular (já aconteceu com os orbes de
     fundo, hoje removidos). `clip`, e não `hidden`: hidden cria área de
     rolagem e quebra o `sticky` do seletor de abas. */
  return (
    <div className="min-h-screen flex relative overflow-x-clip">
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
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 bg-gray-950 border-r border-linha select-none transition-[width] duration-200 ${
          sidebarColapsada ? 'collapsed w-[72px] min-w-[72px]' : 'w-60 lg:w-64'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0 justify-between">
          <div className={`flex items-center ${sidebarColapsada ? 'flex-col gap-2 p-2 pt-4' : 'justify-between px-4 pt-4 pb-2'}`}>
            <Marca compacta={sidebarColapsada} />
            <button
              id="sidebarToggleBtn"
              onClick={alternarSidebar}
              title={sidebarColapsada ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-label={sidebarColapsada ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-expanded={!sidebarColapsada}
              className="w-8 h-8 rounded-md text-gray-500 hover:text-white hover:bg-folha-2 flex items-center justify-center transition-colors shrink-0"
            >
              <span id="sidebarToggleIcon" className={`inline-flex transition-transform duration-200 ${sidebarColapsada ? 'rotate-180' : ''}`}>
                <ChevronLeft size={16} />
              </span>
            </button>
          </div>

          <SidebarNav activeTab={activeTab} irPara={irPara} reduzir={reduzir === true} compacta={sidebarColapsada} />

          <div className="mt-auto">
            <XpFooter compacto={sidebarColapsada} />
            <div className={`flex items-center gap-3 px-4 py-3 border-t border-linha ${sidebarColapsada ? 'justify-center px-2' : ''}`}>
              {!sidebarColapsada && (
                <div className="flex-1 min-w-0 sidebar-label">
                  <p className="text-sm font-medium text-white truncate">{session?.nome || 'Estudante'}</p>
                  <p className="text-xs text-gray-500 truncate">{session?.email || ''}</p>
                </div>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-9 h-9 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                title="Sair da conta"
                aria-label="Sair da conta"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Cabeçalho do celular: menu, a seção em que o aluno está e, só
          quando cai a rede, o aviso de sem conexão. O nome da seção vale
          mais aqui do que a marca: no celular o menu fica fechado e era o
          único lugar que dizia onde a pessoa estava. */}
      <header className="md:hidden flex items-center justify-between gap-3 px-3 py-2 bg-gray-950 border-b border-linha z-40 shrink-0 fixed top-0 left-0 right-0 safe-area-top">
        <div className="flex items-center gap-2 min-w-0">
          <button
            aria-label="Abrir menu"
            aria-expanded={drawerAberto}
            onClick={() => setDrawerAberto(true)}
            className="w-11 h-11 -ml-1 rounded-md text-gray-300 hover:text-white hover:bg-folha-2 flex items-center justify-center transition-colors"
          >
            <Menu size={22} />
          </button>
          <MoonLogo className="w-6 h-6 shrink-0" />
          <span className="font-display text-[1.0625rem] font-semibold text-white truncate">
            {ABA_POR_ID.get(activeTab)?.label ?? 'Central'}
          </span>
        </div>
        {!online && (
          <span role="status" className="flex items-center gap-1.5 px-2 py-1 rounded border border-red-500/40 text-red-300 text-xs font-medium shrink-0">
            <WifiOff size={13} aria-hidden="true" /> Sem conexão
          </span>
        )}
      </header>

      {/* ============================================================
          Conteudo
          ============================================================ */}
      {/* min-w-0 e o que permite o conteudo encolher.
          Por padrao um flex item tem min-width:auto e se RECUSA a ficar
          menor que o conteudo, entao qualquer bloco largo empurrava a
          pagina inteira e o app passava a rolar de lado, mesmo com
          overflow-x-auto no filho. */}
      {/*
          O respiro de topo no mobile acompanha a safe-area.

          O header acima é `fixed` + `safe-area-top`, ou seja, num aparelho
          com notch ele fica ~47px MAIS ALTO. Como o respiro aqui era um
          `pt-20` fixo, nesses aparelhos o começo de cada página passava a
          correr por baixo do header — no chat, era o primeiro balão da
          conversa que sumia. Somando o inset, a reserva cresce junto.

          O rodapé segue a mesma ideia por causa da barra de gestos do
          iPhone, que cobria a última linha de conteúdo.
      */}
      <main
        className={`flex-1 min-w-0 relative z-10 ${sidebarColapsada ? 'md:ml-[72px]' : 'md:ml-60 lg:ml-64'} ${
          activeTab === 'chat'
            ? 'px-2 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:p-3'
            : 'p-3 md:p-6 lg:p-8 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] md:pt-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:pb-8'
        }`}
      >
        <div id="conteudo" tabIndex={-1} className={`${activeTab === 'chat' ? 'max-w-none' : 'max-w-5xl'} mx-auto min-h-[calc(100dvh-3rem)]`}>
          {/*
            Troca de aba nao recarrega a pagina, entao o leitor de tela
            nao anuncia nada por conta propria: quem nao ve a pilula
            amarela mudar de lugar nao sabe que a secao mudou. Esta
            regiao diz o nome da nova secao, sem roubar o foco de onde a
            pessoa esta.
          */}
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {TABS.find((t) => t.id === activeTab)?.label ?? 'Central'}
          </span>
          {/* mode="wait": a pagina que sai termina antes de a nova entrar.
              Com as duas ao mesmo tempo o conteudo se sobrepoe e a leitura
              fica confusa. */}
          <AnimatePresence mode="wait" initial={false}>
            {/*
              Com movimento reduzido a transicao NAO e removida: ela troca
              de forma. Sai o deslize (que e o que incomoda de verdade) e
              fica so o crossfade de opacidade, que nao desloca nada.

              Antes as quatro props viravam `undefined` nesse caso, e a
              troca de aba acontecia sem nenhuma pista visual - quem pediu
              menos movimento ficava sem saber que a secao mudou.
            */}
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
      </main>

      {/* ============================================================
          Mobile: drawer lateral retratil (spec v2.4).
          ============================================================ */}
      <AnimatePresence>
        {drawerAberto && (
          <div className="md:hidden fixed inset-0 z-50">
            <m.button
              className="absolute inset-0 bg-black/65"
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
              className="absolute left-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-gray-950 border-r border-linha flex flex-col justify-between safe-area-top safe-area-bottom"
              initial={reduzir ? { opacity: 0 } : { x: '-100%' }}
              animate={reduzir ? { opacity: 1 } : { x: 0 }}
              exit={reduzir ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Meio rolavel: em telas baixas o menu inteiro rola aqui dentro
                  (overscroll-contain nao deixa a pagina de tras rolar junto)
                  e o pb garante o ultimo item clicavel acima da safe-area. */}
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <Marca />
                  <button
                    onClick={() => setDrawerAberto(false)}
                    aria-label="Fechar menu"
                    className="w-11 h-11 -mr-2 rounded-md text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <SidebarNav activeTab={activeTab} irPara={irPara} reduzir={reduzir === true} />
              </div>

              <div>
                <XpFooter />
                <button
                  onClick={() => { setDrawerAberto(false); logout(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 border-t border-linha text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10"
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
