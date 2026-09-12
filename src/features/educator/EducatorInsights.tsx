import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { supabaseRepository, type InsightTurma } from '../../shared/storage/SupabaseRepository';
import { ClassInsightCard } from './ClassInsightCard';

const JANELAS = [12, 24, 48] as const;

/**
 * EPICO 3: Dashboard de Inteligencia do Educador (lote, sem chats).
 * Equivale a pagina `/educador/dashboard` do spec: no SPA ela vive como
 * aba do EducatorPage. Leitura via RPC agregada; vazia quando sem
 * permissao, sem dados ou sem banco configurado.
 */
export function EducatorInsights() {
  const [horas, setHoras] = useState<number>(24);
  const [dados, setDados] = useState<InsightTurma[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await supabaseRepository.loadInsightsTurma(horas);
      setDados(lista);
    } catch {
      setErro('Não foi possível carregar os insights agora. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [horas]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section aria-label="Dashboard de inteligência da turma" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <BarChart3 size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">O que a turma está errando</h2>
            <p className="text-xs text-slate-500">
              Agregado das últimas {horas}h • sem expor conversas individuais
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Janela de análise" className="flex gap-1 rounded-xl bg-white/5 p-1">
            {JANELAS.map((j) => (
              <button
                key={j}
                onClick={() => setHoras(j)}
                aria-pressed={horas === j}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  horas === j ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {j}h
              </button>
            ))}
          </div>
          <button
            onClick={() => void carregar()}
            disabled={carregando}
            aria-label="Atualizar insights"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-3" aria-label="Carregando insights">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : erro ? (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      ) : dados.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-midnight-900/60 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white">Nenhum ponto crítico na janela 🎉</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
            Sem erros agregados nas últimas {horas}h — ou a turma ainda não respondeu quizzes.
            Sugestão de lote: revisar o tópico mais pedido da semana passada.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dados.map((d) => (
            <ClassInsightCard
              key={`${d.materia}::${d.topico}`}
              insight={d}
              horas={horas}
            />
          ))}
        </div>
      )}
    </section>
  );
}
