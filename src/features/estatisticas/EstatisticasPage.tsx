import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
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

  const cabecalho = (resumoTexto?: string) => (
    <header>
      <h1 className="text-[1.75rem] text-white">Estatísticas</h1>
      <p className="text-sm text-gray-400 mt-1">
        {resumoTexto ?? 'Acerto por matéria e por tópico, somando todos os quizzes que você terminou.'}
      </p>
    </header>
  );

  if (linhas === null) {
    return (
      <div className="space-y-6" aria-busy="true">
        {cabecalho()}
        <div className="space-y-3" role="status" aria-label="Carregando o seu desempenho">
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-24" />
          <div className="skeleton h-40" />
        </div>
      </div>
    );
  }

  if (resumo.totalQuestoes === 0) {
    return (
      <div className="space-y-6">
        {cabecalho()}
        <div className="flex items-center gap-5 py-6 border-y border-linha">
          <img src="/assets/sagui_estudando_2.png" alt="" width={72} height={72} loading="lazy" className="w-[72px] h-[72px] object-contain shrink-0" />
          <div>
            <p className="text-[0.9375rem] text-gray-200">Ainda não há nada para medir.</p>
            <p className="text-sm text-gray-500 mt-0.5 max-w-md">
              Termine um quiz: cada resposta entra no placar do tópico, e aqui aparece onde você vai bem e onde vale insistir.
            </p>
            <button onClick={() => useAppStore.getState().setActiveTab('quiz')} className="btn-primary mt-3">
              Fazer um quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  const corDe = (pct: number) => (pct >= 70 ? '#7cc78a' : pct >= 40 ? '#e9a11c' : '#f08a70');
  const cor = corDe(resumo.aproveitamentoGeral);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {cabecalho(`${resumo.totalQuestoes} questões respondidas, ${resumo.totalAcertos} certas.`)}
        <p className="text-right">
          <span className="numero text-[2.5rem] leading-none" style={{ color: cor }}>{resumo.aproveitamentoGeral}%</span>
          <span className="block text-xs text-gray-500 mt-1">de acerto no geral</span>
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
        {/* Onde agir primeiro: os tópicos com menos acerto, cada um com o
            atalho para treinar. É a parte da tela que vira ação. */}
        <section aria-labelledby="est-atencao">
          <h2 id="est-atencao" className="text-xl text-white pb-3 border-b border-linha">Onde insistir</h2>
          {resumo.pontosFracos.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">
              Nenhum tópico abaixo do esperado, com o mínimo de questões para afirmar isso.
            </p>
          ) : (
            <ul className="pauta">
              {resumo.pontosFracos.slice(0, 5).map((t) => (
                <li key={`${t.materia}:${t.topico}`} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.9375rem] text-white truncate">{t.topico}</p>
                    <p className="text-xs text-gray-500">{t.materia}</p>
                  </div>
                  <span className="font-mono text-sm text-red-300 tabular-nums shrink-0">{t.aproveitamento}%</span>
                  <button
                    onClick={() => praticar(t.materia, t.topico)}
                    className="btn-secondary !min-h-[36px] !py-1.5 !px-3 shrink-0"
                    aria-label={`Treinar ${t.topico}, de ${t.materia}`}
                  >
                    <Play size={13} aria-hidden="true" /> Treinar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Comparação entre matérias: tabela, com os tópicos abrindo
            embaixo de cada uma. */}
        <section aria-labelledby="est-materias">
          <h2 id="est-materias" className="text-xl text-white pb-3 border-b border-linha">Por matéria</h2>
          <div className="pauta">
            {resumo.porMateria.map((m) => (
              <details key={m.materia} className="group">
                <summary className="grid grid-cols-[minmax(0,8rem)_1fr_auto_auto] items-center gap-3 py-3 cursor-pointer list-none">
                  <span className="text-[0.9375rem] text-white truncate">{m.materia}</span>
                  <span className="h-1.5 rounded-full bg-folha-3 overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${m.aproveitamento}%`, backgroundColor: corDe(m.aproveitamento) }} />
                  </span>
                  <span className="font-mono text-sm text-white tabular-nums w-11 text-right">{m.aproveitamento}%</span>
                  <span className="text-xs text-gray-500 tabular-nums w-14 text-right">{m.total} {m.total === 1 ? 'questão' : 'questões'}</span>
                </summary>
                <ul className="pb-3 pl-3 border-l border-linha ml-1 space-y-1.5">
                  {m.topicos.map((t) => (
                    <li key={t.topico} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 text-gray-400 truncate">{t.topico}</span>
                      <span className="font-mono tabular-nums" style={{ color: corDe(t.aproveitamento) }}>{t.aproveitamento}%</span>
                      <span className="text-xs text-gray-500 tabular-nums w-12 text-right">{t.acertos} de {t.total}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Toque numa matéria para ver os tópicos.</p>
        </section>
      </div>
    </div>
  );
}
