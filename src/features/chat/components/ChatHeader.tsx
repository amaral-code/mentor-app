import { memo, type RefObject } from 'react';
import { EllipsisVertical, GraduationCap, History, PanelRightClose, Timer, Volume2, VolumeX } from 'lucide-react';

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
 * Cabeçalho do Mentor: quem responde, as ações da conversa e as áreas.
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
  /* Botão de ação do cabeçalho: mesmo tamanho, mesma borda; ligado é
     folha mais clara com o ícone em luz. Antes cada um tinha a sua cor
     (azul, verde, âmbar) e todos brilhavam no hover. */
  const acao = (ligado: boolean) =>
    `h-9 min-w-9 px-2 rounded-md border flex items-center justify-center gap-1.5 text-sm transition-colors ${
      ligado
        ? 'bg-folha-2 border-gray-600 text-white'
        : 'border-linha-forte text-gray-300 hover:text-white hover:bg-folha-2'
    }`;

  return (
    <header className="relative z-10 border-b border-linha px-3 md:px-5 pt-3 shrink-0" data-purpose="mentor-header">
      <div className="flex items-start justify-between gap-3">
        {/* Identidade: o nome do professor e o que ele cobre. O selo
            "PRO" e o "online" piscando saíram: não havia plano pago nem
            estado de conexão por trás deles. */}
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl text-white truncate">{titulo}</h1>
          <p className="text-sm text-gray-500 truncate">{descricao}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleModoAula}
            title="Modo Aula: só o scanner, sem conversa"
            aria-label={modoAula ? 'Desligar Modo Aula' : 'Ligar Modo Aula'}
            aria-pressed={modoAula}
            className={acao(modoAula)}
          >
            <GraduationCap size={16} className={modoAula ? 'text-amber-400' : ''} aria-hidden="true" />
            <span className="hidden xl:inline">Modo Aula</span>
          </button>
          <button
            onClick={onAbrirFoco}
            title="Pomodoro de 25 minutos: guarde o celular e foque no caderno"
            aria-label="Iniciar Pomodoro de 25 minutos"
            className={acao(false)}
          >
            <Timer size={16} aria-hidden="true" />
            <span className="hidden xl:inline">Pomodoro</span>
          </button>
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Ler as respostas em voz alta' : 'Parar a leitura em voz alta'}
            aria-label={isMuted ? 'Ativar leitura por voz' : 'Silenciar leitura por voz'}
            aria-pressed={!isMuted}
            className={acao(!isMuted)}
          >
            {isMuted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} className="text-amber-400" aria-hidden="true" />}
          </button>
          <button
            onClick={onToggleHistorico}
            title={historicoAberto ? 'Recolher o histórico' : 'Ver conversas anteriores'}
            aria-label={historicoAberto ? 'Recolher histórico' : 'Mostrar histórico'}
            aria-expanded={historicoAberto}
            className={acao(historicoAberto)}
          >
            {historicoAberto ? <PanelRightClose size={16} className="text-amber-400" aria-hidden="true" /> : <History size={16} aria-hidden="true" />}
            <span className="hidden xl:inline">Histórico</span>
          </button>
          <button
            onClick={onOpenPersonas}
            title="Trocar de professor"
            aria-label="Trocar de professor"
            className={acao(false)}
          >
            <EllipsisVertical size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Áreas do ENEM como abas sublinhadas, numa linha própria: antes
          dividiam a linha com o título e as ações, e o título sumia. */}
      <div
        ref={topicTabsRef}
        className="relative mt-2 -mb-px flex items-end gap-1 overflow-x-auto hide-scrollbar"
        data-purpose="topic-filter-tabs"
        role="tablist"
        aria-label="Área da conversa"
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
              className={`topic-tab relative z-10 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                ativo ? 'font-semibold text-white' : 'font-medium text-gray-400 hover:text-white'
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
          className={`absolute bottom-0 h-0.5 rounded-full pointer-events-none ${gliderEmerald ? 'bg-emerald-400' : 'bg-amber-400'}`}
        />
      </div>
    </header>
  );
});
