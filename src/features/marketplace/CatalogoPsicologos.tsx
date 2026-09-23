import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Search, Star } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import { formatarPreco } from '../../shared/lib/bookingEngine';
import type { Psicologo } from '../../shared/types';
import { EmptyState } from '../../shared/ui/EmptyState';
import { BookingModal } from './BookingModal';

interface CatalogoProps {
  /** Para quem o agendamento sera feito. */
  aluno: { id: string; nome: string } | null;
  alertaId?: string | null;
  /** Faixa de preco pre-filtrada quando vem de um alerta. */
  tetoInicial?: number;
}

/**
 * CATALOGO DE PSICOLOGOS.
 *
 * O filtro por VALOR vem primeiro, antes de especialidade, porque e a
 * primeira pergunta real de quem chega aqui vindo de um alerta - e
 * esconder preco atras de "consultar" so faz a familia desistir mais
 * tarde. Cada card mostra o valor da sessao antes de qualquer clique.
 */
export function CatalogoPsicologos({ aluno, alertaId, tetoInicial }: CatalogoProps) {
  const psicologos = useMarketplaceStore((s) => s.psicologos);
  const carregarCatalogo = useMarketplaceStore((s) => s.carregarCatalogo);
  const carregando = useMarketplaceStore((s) => s.carregando);
  const [busca, setBusca] = useState('');
  const [teto, setTeto] = useState(tetoInicial ?? 30000);
  const [escolhido, setEscolhido] = useState<Psicologo | null>(null);

  useEffect(() => {
    if (psicologos.length === 0) void carregarCatalogo();
  }, []);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return psicologos
      .filter((p) => p.valorCentavos <= teto)
      .filter(
        (p) =>
          !termo ||
          p.nome.toLowerCase().includes(termo) ||
          p.especialidades.some((e) => e.toLowerCase().includes(termo)) ||
          p.abordagem.toLowerCase().includes(termo),
      );
  }, [psicologos, busca, teto]);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-light border border-white/[0.04]">
          <Search size={15} className="text-gray-500 shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, abordagem ou especialidade"
            className="bg-transparent text-sm text-white placeholder:text-gray-600 outline-none flex-1 min-w-0"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Valor maximo por sessao</span>
            <span className="text-amber-400 font-semibold tabular-nums">{formatarPreco(teto)}</span>
          </div>
          <input
            type="range"
            min={5000}
            max={30000}
            step={1000}
            value={teto}
            onChange={(e) => setTeto(Number(e.target.value))}
            className="w-full accent-amber-500"
            aria-label="Valor maximo por sessao"
          />
        </div>
      </div>

      {carregando && <p className="text-sm text-gray-500 text-center py-6">Carregando profissionais...</p>}

      {!carregando && lista.length === 0 && (
        <div className="glass rounded-2xl p-5">
          <EmptyState
            pose="meditando"
            compacto
            titulo="Nenhum profissional nesta faixa"
            descricao="Aumente o valor maximo ou limpe a busca. Se a lista estiver vazia mesmo assim, ainda nao ha psicologos cadastrados nesta instalacao."
          />
        </div>
      )}

      <div className="space-y-3">
        {lista.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-600/10 flex items-center justify-center text-violet-300 font-bold text-lg shrink-0">
                {p.nome.charAt(0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-white truncate">{p.nome}</p>
                  <BadgeCheck size={14} className="text-cyan-400 shrink-0" />
                </div>
                <p className="text-[11px] text-gray-500">CRP {p.crp}</p>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                  {/* Nota sem avaliações por trás era o 5,0 padrão do banco,
                      exibido como se fosse elogio. */}
                  {p.totalAvaliacoes > 0 ? (
                    <span className="flex items-center gap-1 text-amber-400" title={`${p.totalAvaliacoes} avaliação(ões)`}>
                      <Star size={11} fill="currentColor" /> {p.notaMedia.toFixed(1)}
                      <span className="text-gray-500">({p.totalAvaliacoes})</span>
                    </span>
                  ) : (
                    <span className="text-gray-500">sem avaliações</span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{p.totalAtendimentos} atendimentos</span>
                  <span aria-hidden="true">·</span>
                  <span>{p.duracaoMinutos} min</span>
                </div>

                {p.bio && <p className="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-3">{p.bio}</p>}

                {p.especialidades.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.especialidades.slice(0, 4).map((e) => (
                      <span
                        key={e}
                        className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-gray-400"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
              <span className="text-base font-bold text-amber-400 tabular-nums">
                {formatarPreco(p.valorCentavos)}
              </span>
              <button onClick={() => setEscolhido(p)} className="btn-primary !px-4 !py-2 text-sm">
                Ver horarios
              </button>
            </div>
          </div>
        ))}
      </div>

      <BookingModal
        psicologo={escolhido}
        aluno={aluno}
        alertaId={alertaId}
        onClose={() => setEscolhido(null)}
      />
    </div>
  );
}
