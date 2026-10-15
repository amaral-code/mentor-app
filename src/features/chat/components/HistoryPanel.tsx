import { memo, useMemo } from 'react';
import { ChevronRight, CloudUpload, PenLine, Plus, Search, Trash2 } from 'lucide-react';
import type { Conversa } from '../../../shared/types';

interface HistoryPanelProps {
  aberto: boolean;
  onFechar: () => void;
  conversas: Conversa[];
  conversaAtivaId: string | null;
  onNova: () => void;
  onTrocar: (id: string) => void;
  onApagar: (id: string) => void;
  onRenomear?: (c: Conversa) => void;
  busca: string;
  onBusca: (v: string) => void;
  criando: boolean;
  trocandoId: string | null;
  apagandoId: string | null;
  confirmarApagarId: string | null;
  onLimparAntigas?: () => void;
}

/** Cor do selo por área (paleta do protótipo). */
/* A área vira só uma palavra em cor discreta: era um selo com fundo,
   borda e negrito em cada linha, e a lista inteira piscava em quatro cores. */
function seloPorModo(modo: string): string {
  const m = modo.toLowerCase();
  if (m.includes('exata')) return 'text-amber-400/80';
  if (m.includes('natureza') || m.includes('ciencia')) return 'text-emerald-400/80';
  return 'text-gray-400';
}

function rotuloArea(modo: string): string {
  const m = modo.toLowerCase();
  if (m.includes('enem_geral') || m.includes('geral')) return 'Geral';
  if (m.includes('exata')) return 'Exatas';
  if (m.includes('linguagem')) return 'Linguagens';
  if (m.includes('natureza')) return 'Natureza';
  if (m.includes('humana')) return 'Humanas';
  if (m.includes('vestibular')) return 'Vestibular';
  return modo || 'Geral';
}

function formatarHoraCurta(ts: number, mesmoDia: boolean): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (mesmoDia) return `${hh}:${mm}`;
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, ${hh}:${mm}`;
}

function inicioDoDia(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Painel de histórico à direita (protótipo AGcode 1:1, dados reais):
 * badge com contagem real, busca filtrando de verdade, grupos
 * Hoje/Ontem/Últimos 7 dias montados de `conversas`, Nova Conversa,
 * renomear e apagar por thread.
 *
 * Memorizado: durante digitacao e streaming no chat, `conversas` mantem a
 * referencia e os callbacks do pai sao estaveis — o painel e pulado.
 */
export const HistoryPanel = memo(function HistoryPanel({
  aberto,
  onFechar,
  conversas,
  conversaAtivaId,
  onNova,
  onTrocar,
  onApagar,
  onRenomear,
  busca,
  onBusca,
  criando,
  trocandoId,
  apagandoId,
  confirmarApagarId,
  onLimparAntigas,
}: HistoryPanelProps) {
  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return conversas;
    return conversas.filter((c) => c.titulo.toLowerCase().includes(q));
  }, [conversas, busca]);

  const grupos = useMemo(() => {
    const agora = inicioDoDia(Date.now());
    const DIA = 86_400_000;
    const hoje: Conversa[] = [];
    const ontem: Conversa[] = [];
    const semana: Conversa[] = [];
    const antigas: Conversa[] = [];
    const ordenadas = [...filtradas].sort((a, b) => b.criadoEm - a.criadoEm);
    for (const c of ordenadas) {
      const dia = inicioDoDia(c.criadoEm || Date.now());
      const diff = Math.round((agora - dia) / DIA);
      if (diff <= 0) hoje.push(c);
      else if (diff === 1) ontem.push(c);
      else if (diff <= 7) semana.push(c);
      // Antes caía em "Últimos 7 dias" também: conversa de março aparecia
      // sob esse título.
      else antigas.push(c);
    }
    return [
      { id: 'hoje', titulo: 'Hoje', itens: hoje },
      { id: 'ontem', titulo: 'Ontem', itens: ontem },
      { id: 'ultimos-7-dias', titulo: 'Últimos 7 dias', itens: semana },
      { id: 'antigas', titulo: 'Mais antigas', itens: antigas },
    ].filter((g) => g.itens.length > 0);
  }, [filtradas]);

  return (
    <aside
      aria-label="Histórico de conversas"
      aria-hidden={!aberto}
      data-purpose="conversation-history-sidebar"
      id="historySidebar"
      /* Sem `relative` aqui: com `relative` e `absolute` na mesma
         lista, o Tailwind gera `relative` depois e ele vence. No celular o
         painel deixava de flutuar e roubava 288px da conversa, e a caixa
         de texto virava uma coluna de uma letra por linha. */
      className={`flex-col w-[min(18rem,85vw)] md:w-72 shrink-0 bg-folha border border-linha justify-between self-stretch max-h-full select-none overflow-hidden rounded-2xl ${
        aberto ? 'flex absolute md:static inset-y-0 right-0 z-30 shadow-camada md:shadow-none' : 'hidden'
      }`}
    >
      <div className="p-3 border-b border-linha flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base text-white">Conversas</h2>
            <span className="text-xs text-gray-500 font-mono tabular-nums">{conversas.length}</span>
          </div>
          <button
            onClick={onFechar}
            title="Recolher painel"
            aria-label="Recolher histórico"
            className="w-9 h-9 rounded-md text-gray-400 hover:text-white hover:bg-folha-2 flex items-center justify-center transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <button
          onClick={onNova}
          disabled={criando}
          id="btnNovaConversa"
          className="btn-secondary w-full"
        >
          <Plus size={16} aria-hidden="true" />
          <span>{criando ? 'Criando...' : 'Nova conversa'}</span>
        </button>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            className="w-full !pl-9 !py-2 text-sm"
            aria-label="Buscar nas conversas"
            id="historySearchInput"
            placeholder="Buscar pelo título"
            type="search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 min-h-0" id="historyItemsContainer">
        {filtradas.length === 0 && (
          <div className="text-center px-3 py-8">
            <p className="text-sm text-gray-300">
              {conversas.length === 0 ? 'Nenhuma conversa ainda.' : `Nenhum título com "${busca.trim()}".`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {conversas.length === 0 ? 'Cada pergunta que você fizer fica guardada aqui.' : 'A busca olha só o título das conversas.'}
            </p>
          </div>
        )}
        {grupos.map((g) => (
          <div key={g.id} className="history-group space-y-0.5" data-group={g.id}>
            <p className="px-2 pb-1 text-xs font-medium text-gray-500">{g.titulo}</p>
            {g.itens.map((c) => {
              const ativa = c.id === conversaAtivaId;
              const confirmar = confirmarApagarId === c.id;
              const mesmoDia = inicioDoDia(c.criadoEm || Date.now()) === inicioDoDia(Date.now());
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-current={ativa ? 'true' : undefined}
                  onClick={() => onTrocar(c.id)}
                  onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTrocar(c.id); } }}
                  className={`history-item group relative flex flex-col px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                    ativa ? 'bg-folha-3' : 'hover:bg-folha-2'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <h4
                      className={`chat-title text-sm truncate flex-1 ${
                        ativa ? 'font-semibold text-white' : 'text-gray-300 group-hover:text-white'
                      }`}
                    >
                      {trocandoId === c.id ? 'Abrindo...' : c.titulo}
                    </h4>
                    {/* Visíveis sempre no celular (não existe hover no
                        toque) e no foco do teclado; no computador, no hover. */}
                    <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity shrink-0">
                      {onRenomear && (
                        <button
                          className="text-gray-500 hover:text-white w-7 h-7 flex items-center justify-center rounded"
                          onClick={(e) => { e.stopPropagation(); onRenomear(c); }}
                          title="Renomear"
                          aria-label={`Renomear ${c.titulo}`}
                        >
                          <PenLine size={13} />
                        </button>
                      )}
                      <button
                        className={`h-7 min-w-7 px-1 flex items-center justify-center rounded ${confirmar ? 'text-red-300 bg-red-500/15' : 'text-gray-500 hover:text-red-400'}`}
                        onClick={(e) => { e.stopPropagation(); onApagar(c.id); }}
                        disabled={apagandoId !== null}
                        title={confirmar ? 'Clique de novo para confirmar' : 'Excluir'}
                        aria-label={confirmar ? `Confirmar apagar ${c.titulo}` : `Apagar ${c.titulo}`}
                      >
                        {apagandoId === c.id ? <span className="text-xs">...</span> : confirmar ? <span className="text-xs font-semibold">Apagar?</span> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className={seloPorModo(c.modo)}>
                      {rotuloArea(c.modo)}
                    </span>
                    <span className="font-mono">
                      {formatarHoraCurta(c.criadoEm || Date.now(), mesmoDia)}
                    </span>
                  </div>
                  {ativa && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-amber-400" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="px-3 py-2.5 border-t border-linha flex items-center justify-between text-xs text-gray-500 shrink-0">
        <div className="flex items-center gap-2">
          <CloudUpload size={14} aria-hidden="true" />
          <span>Salvas na sua conta</span>
        </div>
        {onLimparAntigas && (
          <button
            className="text-gray-500 hover:text-red-400 transition-colors w-8 h-8 flex items-center justify-center rounded"
            onClick={onLimparAntigas}
            title="Limpar histórico antigo"
            aria-label="Limpar histórico antigo"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </aside>
  );
});
