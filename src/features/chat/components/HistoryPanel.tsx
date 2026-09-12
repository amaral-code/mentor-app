import { memo, useMemo } from 'react';
import { ChevronRight, CloudUpload, History, PenLine, Plus, Search, Trash2 } from 'lucide-react';
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
function seloPorModo(modo: string): string {
  const m = modo.toLowerCase();
  if (m.includes('exata')) return 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.25)]';
  if (m.includes('linguagem') || m.includes('humana') || m.includes('portugu')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]';
  if (m.includes('natureza') || m.includes('ciencia')) return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]';
  return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 shadow-[0_0_8px_rgba(99,102,241,0.2)]';
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
    const ordenadas = [...filtradas].sort((a, b) => b.criadoEm - a.criadoEm);
    for (const c of ordenadas) {
      const dia = inicioDoDia(c.criadoEm || Date.now());
      const diff = Math.round((agora - dia) / DIA);
      if (diff <= 0) hoje.push(c);
      else if (diff === 1) ontem.push(c);
      else if (diff <= 7) semana.push(c);
      else semana.push(c);
    }
    return [
      { id: 'hoje', titulo: 'Hoje', itens: hoje },
      { id: 'ontem', titulo: 'Ontem', itens: ontem },
      { id: 'ultimos-7-dias', titulo: 'Últimos 7 dias', itens: semana },
    ].filter((g) => g.itens.length > 0);
  }, [filtradas]);

  return (
    <aside
      aria-label="Histórico de conversas"
      aria-hidden={!aberto}
      data-purpose="conversation-history-sidebar"
      id="historySidebar"
      className={`flex-col w-72 md:w-80 shrink-0 bg-[#0a0f1d]/90 backdrop-blur-2xl border-l border-white/10 justify-between self-stretch max-h-full select-none relative overflow-hidden shadow-[-4px_0_30px_rgba(0,0,0,0.5)] rounded-2xl border ${
        aberto ? 'flex absolute md:static inset-y-0 right-0 z-30' : 'hidden'
      }`}
    >
      <div className="p-3.5 border-b border-white/10 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500/20 to-amber-400/10 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
              <History size={14} />
            </div>
            <h3 className="font-display font-bold text-white text-sm tracking-wide">Histórico</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#12192b] text-amber-300 border border-amber-500/30 font-mono font-semibold">
              {conversas.length} {conversas.length === 1 ? 'chat' : 'chats'}
            </span>
          </div>
          <button
            onClick={onFechar}
            title="Recolher painel"
            aria-label="Recolher histórico"
            className="w-7 h-7 rounded-lg bg-[#12192b] hover:bg-[#1a233a] border border-white/10 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <button
          onClick={onNova}
          disabled={criando}
          id="btnNovaConversa"
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-midnight-950 font-display font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.45)] hover:shadow-[0_0_28px_rgba(245,158,11,0.7)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={3} />
          <span>{criando ? 'Criando...' : 'Nova Conversa'}</span>
        </button>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            className="w-full bg-[#070b14]/90 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 font-sans transition-all"
            id="historySearchInput"
            placeholder="Buscar no histórico..."
            type="text"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs font-sans min-h-0" id="historyItemsContainer">
        {filtradas.length === 0 && (
          <div className="text-center px-3 py-8">
            <History size={22} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs text-slate-400 font-medium">
              {conversas.length === 0 ? 'Nenhuma conversa ainda.' : 'Nada encontrado para essa busca.'}
            </p>
            {conversas.length === 0 && (
              <p className="text-[11px] text-slate-500 mt-1">Clique em Nova Conversa para começar.</p>
            )}
          </div>
        )}
        {grupos.map((g) => (
          <div key={g.id} className="history-group space-y-1.5" data-group={g.id}>
            <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display flex items-center justify-between">
              <span>{g.titulo}</span>
              <span className="text-[9px] text-amber-400 font-mono font-bold">{g.itens.length}</span>
            </div>
            {g.itens.map((c) => {
              const ativa = c.id === conversaAtivaId;
              const confirmar = confirmarApagarId === c.id;
              const mesmoDia = inicioDoDia(c.criadoEm || Date.now()) === inicioDoDia(Date.now());
              return (
                <div
                  key={c.id}
                  onClick={() => onTrocar(c.id)}
                  className={`history-item group relative flex flex-col p-2.5 rounded-xl cursor-pointer transition-all hover:translate-x-1 ${
                    ativa
                      ? 'bg-gradient-to-r from-amber-500/15 via-[#161f36] to-[#0e1628] border border-amber-400/60 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
                      : 'bg-[#0f1628]/80 hover:bg-[#162138] border border-white/5 hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <h4
                      className={`chat-title text-xs truncate flex-1 transition-colors ${
                        ativa ? 'font-semibold text-white group-hover:text-amber-300' : 'font-medium text-slate-300 group-hover:text-white'
                      }`}
                    >
                      {trocandoId === c.id ? 'Abrindo...' : c.titulo}
                    </h4>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {onRenomear && (
                        <button
                          className="text-slate-400 hover:text-white p-0.5"
                          onClick={(e) => { e.stopPropagation(); onRenomear(c); }}
                          title="Renomear"
                          aria-label={`Renomear ${c.titulo}`}
                        >
                          <PenLine size={10} />
                        </button>
                      )}
                      <button
                        className={`p-0.5 ${confirmar ? 'text-red-300' : 'text-slate-400 hover:text-rose-400'}`}
                        onClick={(e) => { e.stopPropagation(); onApagar(c.id); }}
                        disabled={apagandoId !== null}
                        title={confirmar ? 'Clique de novo para confirmar' : 'Excluir'}
                        aria-label={confirmar ? `Confirmar apagar ${c.titulo}` : `Apagar ${c.titulo}`}
                      >
                        {apagandoId === c.id ? <span className="text-[9px]">...</span> : confirmar ? <span className="text-[9px] font-bold">Apagar?</span> : <Trash2 size={10} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md border font-bold ${seloPorModo(c.modo)}`}>
                      {rotuloArea(c.modo)}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {formatarHoraCurta(c.criadoEm || Date.now(), mesmoDia)}
                    </span>
                  </div>
                  {ativa && (
                    <div className="absolute -left-1 top-2 bottom-2 w-1.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_10px_#f59e0b,0_0_3px_#fff]" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-3 bg-[#080d19]/95 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 shrink-0">
        <div className="flex items-center gap-2">
          <CloudUpload size={14} className="text-amber-400 drop-shadow-[0_0_6px_#f59e0b]" />
          <span className="font-medium">Sincronizado na nuvem</span>
        </div>
        {onLimparAntigas && (
          <button
            className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer p-1 active:scale-95"
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
