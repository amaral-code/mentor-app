import type { RefObject } from 'react';
import { EllipsisVertical, History, Lightbulb, PanelRightClose, Volume2, VolumeX } from 'lucide-react';

/** Aba temática do Mentor (espelha ABAS_MENTOR do ChatPage). */
export interface AbaMentor {
  id: string;
  label: string;
  modo: string;
}

interface ChatHeaderProps {
  titulo: string;
  descricao: string;
  materiaRetomada: string | null;
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
}

/**
 * Header do Mentor (protótipo AGcode 1:1, <i class="fa-..."> trocado por
 * lucide-react nas mesmas classes — o CDN do FontAwesome foi removido
 * porque a CSP do index.html bloqueia domínios externos).
 */
export function ChatHeader({
  titulo,
  descricao,
  materiaRetomada,
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
}: ChatHeaderProps) {
  return (
    <header
      className="relative z-10 h-16 border-b border-white/10 bg-[#0a0f1d]/85 backdrop-blur-xl px-3 md:px-6 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 shadow-[0_4px_25px_rgba(0,0,0,0.4)] shrink-0"
      data-purpose="mentor-header"
    >
      {/* Identidade do Mentor */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.3)] shrink-0" aria-hidden="true">
          <Lightbulb size={16} className="drop-shadow-[0_0_6px_#f59e0b]" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0f1d] emerald-ping-glow" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-white text-sm tracking-wide truncate">
              {titulo}
            </h2>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold shrink-0">
              PRO
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-400/50 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.35)] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
              online
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans hidden sm:block truncate">
            {descricao}
            {materiaRetomada && (
              <>
                <span className="text-gray-600"> · </span>
                <span className="text-violet-400/90">retomando: {materiaRetomada}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Abas de tópico com glider deslizante (scroll horizontal no mobile). */}
      <div
        ref={topicTabsRef}
        className="relative bg-[#0e1424]/90 p-1 rounded-xl border border-white/10 flex items-center text-xs backdrop-blur-md shadow-inner shrink-0 overflow-x-auto hide-scrollbar max-w-[38vw] md:max-w-none"
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
                  ? `font-semibold ${t.id === 'natureza' ? 'text-emerald-300' : 'text-amber-300'}`
                  : 'font-medium text-slate-400 hover:text-white'
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
              ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'bg-gradient-to-r from-amber-500/25 to-amber-600/20 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
          }`}
        />
      </div>

      {/* Ações rápidas */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleHistorico}
          title="Alternar Histórico de Conversas"
          aria-label={historicoAberto ? 'Recolher histórico' : 'Mostrar histórico'}
          aria-expanded={historicoAberto}
          className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-sm active:scale-95 ${
            historicoAberto
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              : 'bg-[#131b2e]/90 hover:bg-[#1a253f] border-white/10 hover:border-amber-500/50 text-slate-300 hover:text-amber-300'
          }`}
        >
          {historicoAberto ? <PanelRightClose size={14} className="text-amber-400" /> : <History size={14} className="text-amber-400" />}
          <span className="hidden lg:inline text-[11px] font-semibold">Histórico</span>
        </button>
        <button
          onClick={onToggleMute}
          title="Ouvir Narração / Voz"
          aria-label={isMuted ? 'Ativar leitura por voz' : 'Silenciar leitura por voz'}
          aria-pressed={!isMuted}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm active:scale-95 ${
            isMuted
              ? 'bg-[#131b2e]/90 hover:bg-[#1a253f] border-white/10 text-slate-300 hover:text-amber-300 hover:border-amber-500/50'
              : 'bg-amber-500/15 border-amber-500/50 text-amber-300'
          }`}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button
          onClick={onOpenPersonas}
          title="Trocar de professor"
          aria-label="Trocar de professor"
          className="w-8 h-8 rounded-xl bg-[#131b2e]/90 hover:bg-[#1a253f] border border-white/10 text-slate-300 hover:text-amber-300 hover:border-amber-500/50 flex items-center justify-center transition-all shadow-sm active:scale-95"
        >
          <EllipsisVertical size={14} />
        </button>
      </div>
    </header>
  );
}
