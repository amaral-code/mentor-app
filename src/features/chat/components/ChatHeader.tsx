import { memo, type RefObject } from 'react';
import { EllipsisVertical, GraduationCap, History, Lightbulb, PanelRightClose, Timer, Volume2, VolumeX } from 'lucide-react';

/** Aba temática do Mentor (espelha ABAS_MENTOR do ChatPage). */
export interface AbaMentor {
  id: string;
  label: string;
  modo: string;
}

interface ChatHeaderProps {
  titulo: string;
  descricao: string;
  abas: readonly AbaMentor[];
  abaAtivaId: string;
  onTrocarAba: (aba: AbaMentor) => void;
  topicTabsRef: RefObject<HTMLDivElement | null>;
  registrarBotaoAba: (id: string, el: HTMLButtonElement | null) => void;
  glider: { left: number; width: number };
  gliderEmerald: boolean;
  historicoAberto: boolean;
  onToggleHistorico: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenPersonas: () => void;
  /** Modo Sala de Aula: esconde o chat, libera so o scanner (OCR). */
  modoAula: boolean;
  onToggleModoAula: () => void;
  /** Ancora de Foco: abre o overlay do Pomodoro de 25 min. */
  onAbrirFoco: () => void;
}

/**
 * Header do Mentor (protótipo AGcode 1:1, <i class="fa-..."> trocado por
 * lucide-react nas mesmas classes — o CDN do FontAwesome foi removido
 * porque a CSP do index.html bloqueia domínios externos).
 *
 * Memorizado: o pai atualiza a cada tecla/streaming; o header so muda de
 * fato ao trocar de aba, mutar ou abrir/fechar historico.
 */
export const ChatHeader = memo(function ChatHeader({
  titulo,
  descricao,
  abas,
  abaAtivaId,
  onTrocarAba,
  topicTabsRef,
  registrarBotaoAba,
  glider,
  gliderEmerald,
  historicoAberto,
  onToggleHistorico,
  isMuted,
  onToggleMute,
  onOpenPersonas,
  modoAula,
  onToggleModoAula,
  onAbrirFoco,
}: ChatHeaderProps) {
  return (
    <header
      className="relative z-10 h-16 border-b-2 border-slate-200 bg-white px-3 md:px-6 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 shrink-0"
      data-purpose="mentor-header"
    >
      {/* Identidade do Mentor */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-10 h-10 rounded-xl bg-azul-100 flex items-center justify-center text-azul-600 shrink-0" aria-hidden="true">
          <Lightbulb size={16} className="" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-200 emerald-ping-glow" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-tinta-900 text-sm tracking-wide truncate">
              {titulo}
            </h2>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 border border-amber-500/40 font-mono font-bold shrink-0">
              PRO
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-400/50 px-2 py-0.5 rounded-full  shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse " />
              online
            </span>
          </div>
          <p className="text-[11px] text-slate-600 font-sans hidden sm:block truncate">
            {descricao}
          </p>
        </div>
      </div>

      {/* Abas de tópico com glider deslizante (scroll horizontal no mobile). */}
      <div
        ref={topicTabsRef}
        className="relative bg-white p-1 rounded-xl border border-slate-200 flex items-center text-xs backdrop-blur-md shadow-none shrink-0 overflow-x-auto hide-scrollbar max-w-[38vw] md:max-w-none"
        data-purpose="topic-filter-tabs"
        role="tablist"
        aria-label="Áreas de estudo"
      >
        {abas.map((t) => {
          const ativo = abaAtivaId === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={ativo}
              data-topic={t.id}
              ref={(el) => registrarBotaoAba(t.id, el)}
              onClick={() => onTrocarAba(t)}
              className={`topic-tab relative z-10 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                ativo
                  ? `font-semibold ${t.id === 'natureza' ? 'text-emerald-600' : 'text-amber-600'}`
                  : 'font-medium text-slate-600 hover:text-tinta-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <div
          id="topicActiveGlider"
          aria-hidden="true"
          style={{ left: glider.left, width: glider.width || undefined }}
          className={`absolute inset-y-1 rounded-lg border pointer-events-none ${
            gliderEmerald
              ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 border-emerald-400/50 '
              : 'bg-gradient-to-r from-amber-500/25 to-amber-600/20 border-amber-400/50 '
          }`}
        />
      </div>

      {/* Ações rápidas */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleModoAula}
          title="Modo Aula: só scanner, sem chat"
          aria-label={modoAula ? 'Desligar Modo Aula' : 'Ligar Modo Aula'}
          aria-pressed={modoAula}
          className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-sm active:scale-95 ${
            modoAula
              ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-700'
              : 'bg-white hover:bg-white border-slate-200 hover:border-cyan-500/50 text-slate-700 hover:text-cyan-700'
          }`}
        >
          <GraduationCap size={14} className={modoAula ? 'text-cyan-700' : 'text-slate-600'} />
          <span className="hidden lg:inline text-[11px] font-semibold">Modo Aula</span>
        </button>
        <button
          onClick={onAbrirFoco}
          title="Pomodoro (25 min): guarde o celular e foque no caderno"
          aria-label="Iniciar Pomodoro de 25 minutos"
          className="h-8 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-sm active:scale-95 bg-white hover:bg-white border-slate-200 hover:border-emerald-500/50 text-slate-700 hover:text-emerald-600"
        >
          <Timer size={14} className="text-slate-600" />
          <span className="hidden lg:inline text-[11px] font-semibold">Pomodoro</span>
        </button>
        <button
          onClick={onToggleHistorico}
          title="Alternar Histórico de Conversas"
          aria-label={historicoAberto ? 'Recolher histórico' : 'Mostrar histórico'}
          aria-expanded={historicoAberto}
          className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-sm active:scale-95 ${
            historicoAberto
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-600'
              : 'bg-white hover:bg-white border-slate-200 hover:border-amber-500/50 text-slate-700 hover:text-amber-600'
          }`}
        >
          {historicoAberto ? <PanelRightClose size={14} className="text-amber-600" /> : <History size={14} className="text-amber-600" />}
          <span className="hidden lg:inline text-[11px] font-semibold">Histórico</span>
        </button>
        <button
          onClick={onToggleMute}
          title="Ouvir Narração / Voz"
          aria-label={isMuted ? 'Ativar leitura por voz' : 'Silenciar leitura por voz'}
          aria-pressed={!isMuted}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm active:scale-95 ${
            isMuted
              ? 'bg-white hover:bg-white border-slate-200 text-slate-700 hover:text-amber-600 hover:border-amber-500/50'
              : 'bg-amber-500/15 border-amber-500/50 text-amber-600'
          }`}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button
          onClick={onOpenPersonas}
          title="Trocar de professor"
          aria-label="Trocar de professor"
          className="w-8 h-8 rounded-xl bg-white hover:bg-white border border-slate-200 text-slate-700 hover:text-amber-600 hover:border-amber-500/50 flex items-center justify-center transition-all shadow-sm active:scale-95"
        >
          <EllipsisVertical size={14} />
        </button>
      </div>
    </header>
  );
});
