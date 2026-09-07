import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Crosshair, Play } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { supabaseRepository, DesempenhoTopico } from '../../shared/storage/SupabaseRepository';
import { calcularEstatisticas } from '../../shared/lib/quizStats';

/**
 * ESTATISTICAS - aproveitamento e pontos fracos por materia/topico.
 *
 * Fonte: placar acumulado em quiz_desempenho_topicos (migration 015),
 * alimentado a cada quiz finalizado. Toda a matematica (percentuais,
 * ranking, amostra minima) vive em quizStats.ts; aqui e so leitura e
 * layout. Sem linhas no banco, a tela ensina a gerar dados em vez de
 * mostrar zeros que pareceriam diagnostico.
 */
export function EstatisticasPage() {
  const [linhas, setLinhas] = useState<DesempenhoTopico[] | null>(null);

  useEffect(() => {
    let vivo = true;
    supabaseRepository
      .loadDesempenhoTopicos()
      .then((d) => {
        if (vivo) setLinhas(d);
      })
      .catch(() => {
        if (vivo) setLinhas([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const resumo = useMemo(() => calcularEstatisticas(linhas ?? []), [linhas]);

  function praticar(materia: string, topico: string) {
    // Reaproveita a entrada de revisao do QuizPage: abre o quiz ja
    // configurado para materia+topico, sem passar pela selecao.
    (window as any).__revisaoAtiva = {
      topicoId: `est:${materia}:${topico}`,
      topicoNome: topico,
      materia,
    };
    useAppStore.getState().setActiveTab('quiz');
  }

  if (linhas === null) {
    return (
      <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Carregando seu desempenho...</p>
        </div>
      </div>
    );
  }

  if (resumo.totalQuestoes === 0) {
    return (
      <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-cyan-600/10 flex items-center justify-center">
            <BarChart3 size={16} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Estatísticas</h1>
            <p className="text-sm text-gray-500 mt-0.5">Seu aproveitamento por matéria e tópico</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-gray-300 font-medium">Sem dados ainda.</p>
          <p className="text-sm text-gray-500 mt-2">
            Finalize um quiz e cada resposta passa a contar no seu placar por tópico.
          </p>
          <button
            onClick={() => useAppStore.getState().setActiveTab('quiz')}
            className="btn-primary mt-5"
          >
            Fazer um quiz
          </button>
        </div>
      </div>
    );
  }

  const cor = resumo.aproveitamentoGeral >= 70 ? '#10b981' : resumo.aproveitamentoGeral >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-cyan-600/10 flex items-center justify-center">
          <BarChart3 size={16} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Estatísticas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {resumo.totalQuestoes} questões respondidas • {resumo.totalAcertos} acertos
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Aproveitamento geral</p>
        <p className="text-4xl font-extrabold tabular-nums mt-1" style={{ color: cor }}>
          {resumo.aproveitamentoGeral}%
        </p>
        <div className="h-2 rounded-full bg-white/5 mt-3 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${resumo.aproveitamentoGeral}%`, backgroundColor: cor }} />
        </div>
      </div>

      {resumo.pontosFracos.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-red-500/10">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Crosshair size={16} className="text-red-400" /> Precisam de atenção
          </h2>
          <div className="space-y-2.5">
            {resumo.pontosFracos.slice(0, 5).map((t) => (
              <div key={`${t.materia}:${t.topico}`} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {t.topico} <span className="text-gray-500">• {t.materia}</span>
                  </p>
                  <div className="h-1.5 rounded-full bg-white/5 mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400/80"
                      style={{ width: `${t.aproveitamento}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-red-300 tabular-nums shrink-0">{t.aproveitamento}%</span>
                <button
                  onClick={() => praticar(t.materia, t.topico)}
                  className="btn-secondary !px-3 !py-2 text-xs shrink-0 flex items-center gap-1"
                >
                  <Play size={12} /> Praticar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {resumo.porMateria.map((m) => (
          <details key={m.materia} className="glass rounded-2xl px-5 py-4 group">
            <summary className="flex items-center gap-3 cursor-pointer list-none">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{m.materia}</p>
                <div className="h-1.5 rounded-full bg-white/5 mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${m.aproveitamento}%`,
                      backgroundColor: m.aproveitamento >= 70 ? '#10b981' : m.aproveitamento >= 40 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-bold text-white tabular-nums shrink-0">{m.aproveitamento}%</span>
              <span className="text-xs text-gray-500 shrink-0 tabular-nums">{m.total}q</span>
            </summary>
            <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
              {m.topicos.map((t) => (
                <div key={t.topico} className="flex items-center gap-3">
                  <p className="flex-1 text-xs text-gray-400 truncate">{t.topico}</p>
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${t.aproveitamento >= 70 ? 'text-emerald-400' : t.aproveitamento >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                    {t.aproveitamento}%
                  </span>
                  <span className="text-[11px] text-gray-600 tabular-nums shrink-0">
                    {t.acertos}/{t.total}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
