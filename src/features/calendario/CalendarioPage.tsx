import { useEffect, useMemo, useState } from 'react';
import { Brain, CalendarDays, CircleAlert, Plus } from 'lucide-react';
import { useBemEstarStore } from '../../stores/bemEstarStore';
import { useAppStore } from '../../stores/appStore';
import {
  ROTULO_NIVEL,
  forcaDaMemoria,
  limitarCargaDiaria,
  montarAgenda,
  proximaRevisao,
} from '../../shared/lib/srsEngine';
import type { RevisaoEspacada } from '../../shared/types';
import { EmptyState } from '../../shared/ui/EmptyState';

/**
 * CALENDARIO ADAPTATIVO (curva de Ebbinghaus).
 *
 * A tela nao tem "montar cronograma" e isso e a funcionalidade: cada
 * quiz respondido agenda sozinho a proxima revisao do topico, e o que
 * aparece aqui e so a fila do dia. O aluno escolhe fazer ou nao, nunca
 * escolhe QUANDO - essa conta e do algoritmo.
 *
 * O teto diario existe pelo mesmo motivo: depois de uma semana parado a
 * fila acumula, e uma lista de 30 itens em vermelho e um convite a
 * fechar o app.
 */

const TETO_DIARIO = 8;

export function CalendarioPage() {
  const revisoes = useBemEstarStore((s) => s.revisoes);
  const carregado = useBemEstarStore((s) => s.carregado);
  const carregarTudo = useBemEstarStore((s) => s.carregarTudo);
  const agendarRevisao = useBemEstarStore((s) => s.agendarRevisao);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setToast = useAppStore((s) => s.setToast);
  const [dias, setDias] = useState(14);

  useEffect(() => {
    if (!carregado) void carregarTudo();
  }, [carregado]);

  const hoje = useMemo(() => limitarCargaDiaria(revisoes, TETO_DIARIO), [revisoes]);
  const agenda = useMemo(() => montarAgenda(revisoes, dias), [revisoes, dias]);

  function abrirRevisao(r: RevisaoEspacada) {
    // O quiz e o mecanismo de revisao: ao terminar, o resultado volta
    // para agendarRevisao e recalcula a data.
    (window as any).__revisaoAtiva = { topicoId: r.topicoId, topicoNome: r.topicoNome, materia: r.materia };
    setActiveTab('quiz');
    setToast(`Revisao de ${r.topicoNome}. O resultado reagenda a próxima data.`, 'info');
  }

  async function adiar(r: RevisaoEspacada) {
    // Adiar = tratar como revisao mediana: nao sobe de nivel, mas sai da
    // fila de hoje. Melhor que deixar o item vermelho para sempre.
    await agendarRevisao(r.topicoId, r.topicoNome, r.materia, 70);
    setToast('Topico reagendado.', 'info');
  }

  return (
    <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/15 to-indigo-600/10 flex items-center justify-center">
          <CalendarDays size={20} className="text-sky-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-white">Calendario Adaptativo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            As revisões entram sozinhas, no dia em que a memória começa a falhar
          </p>
        </div>
      </div>

      {/* Fila de hoje */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Para revisar hoje</h2>
          <span className="text-xs text-gray-500 tabular-nums">
            {hoje.hoje.length} de {hoje.hoje.length + hoje.adiadas.length}
          </span>
        </div>

        {hoje.hoje.length === 0 ? (
          <EmptyState
            pose="aprovacao"
            compacto
            titulo="Nada vencendo hoje"
            descricao="Faca um quiz de qualquer materia: o topico entra no calendario automaticamente."
            acao={
              <button onClick={() => setActiveTab('quiz')} className="btn-primary text-sm">
                Ir para o quiz
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {hoje.hoje.map((r) => {
              const forca = forcaDaMemoria(r);
              const atrasada = r.proximaRevisao < new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={r.topicoId}
                  className="flex items-center gap-3 py-3 px-3 rounded-xl glass-light border border-white/[0.03]"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                    <Brain size={16} className="text-sky-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{r.topicoNome}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {r.materia || 'Geral'} · {ROTULO_NIVEL[r.nivelMemoria]} · memória {forca}%
                      {atrasada && ' · atrasada'}
                    </p>
                  </div>

                  <button onClick={() => abrirRevisao(r)} className="btn-primary !px-3 !py-2 text-xs shrink-0">
                    Revisar
                  </button>
                  <button
                    onClick={() => adiar(r)}
                    className="btn-ghost !px-2 !py-2 text-[11px] text-gray-500 shrink-0"
                    title="Adiar para a próxima data calculada"
                  >
                    Adiar
                  </button>
                </div>
              );
            })}

            {hoje.adiadas.length > 0 && (
              <p className="text-[11px] text-gray-500 pt-2 flex items-center gap-1.5">
                <CircleAlert size={13} className="text-amber-400" />
                {hoje.adiadas.length} topico(s) alem do teto de {TETO_DIARIO} por dia entram na fila de amanha.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Linha do tempo */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Proximos dias</h2>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                  dias === d ? 'bg-sky-500/15 text-sky-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-1 h-24">
          {agenda.map((dia) => {
            const altura = Math.min(100, dia.revisoes.length * 22);
            const data = new Date(`${dia.data}T12:00:00`);
            return (
              <div key={dia.data} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${dia.revisoes.length} revisao(oes)`}>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    dia.revisoes.length === 0
                      ? 'bg-white/[0.03]'
                      : dia.atrasadas > 0
                        ? 'bg-amber-500/70'
                        : 'bg-sky-500/60'
                  }`}
                  style={{ height: `${Math.max(4, altura)}%` }}
                />
                <span className="text-[9px] text-gray-600 tabular-nums">{data.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Todos os topicos */}
      {revisoes.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Todos os topicos ({revisoes.length})</h2>
          <div className="space-y-1.5">
            {revisoes.map((r) => (
              <div key={r.topicoId} className="flex items-center justify-between text-sm py-2 px-3 rounded-xl hover:bg-white/[0.02]">
                <div className="min-w-0">
                  <p className="text-gray-300 truncate">{r.topicoNome}</p>
                  <p className="text-[10px] text-gray-600">
                    Nível {r.nivelMemoria}/5 · intervalo de {r.intervaloDias} dia(s) · fator {r.facilidade.toFixed(2)}
                  </p>
                </div>
                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                  {new Date(`${r.proximaRevisao}T12:00:00`).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-light rounded-xl px-4 py-3 text-xs text-gray-500 leading-relaxed">
        <p className="flex items-center gap-1.5 text-gray-400 font-medium mb-1">
          <Plus size={13} /> Como as datas sao escolhidas
        </p>
        Nota 80 ou mais sobe um nível (1, 3, 7, 21, 45 e 90 dias). Entre 60 e 79 mantém o nível com o
        intervalo ajustado pelo seu histórico no topico. Abaixo de 60 o topico volta para amanha.
        Exemplo com a sua ultima nota: {' '}
        <span className="text-gray-300">
          {(() => {
            const exemplo = proximaRevisao({ nivelMemoria: 1, facilidade: 2.5, intervaloDias: 3 }, 85);
            return `nível 1 + nota 85 = revisar em ${exemplo.intervaloDias} dias`;
          })()}
        </span>
        .
      </div>
    </div>
  );
}
