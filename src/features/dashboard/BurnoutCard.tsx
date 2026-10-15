import { useEffect, useState } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { useBemEstarStore } from '../../stores/bemEstarStore';
import { useAppStore } from '../../stores/appStore';
import { COR_CLASSE, ROTULO_CLASSE, sugestaoPausa } from '../../shared/lib/burnoutModel';

/**
 * Indice de fadiga no painel do aluno.
 *
 * Mostra o SCORE e os motivos, nunca um diagnostico. A diferenca entre
 * "voce esta esgotado" e "seus ultimos dias tem madrugada e queda de
 * acerto" e a diferenca entre rotular alguem e devolver a ele um dado
 * que ele pode usar.
 *
 * Enquanto houver menos de 5 respostas na janela o card nao aparece:
 * classificar burnout com tres cliques seria chute com cara de medida.
 */
export function BurnoutCard() {
  const previsao = useBemEstarStore((s) => s.previsao);
  const historicoBurnout = useBemEstarStore((s) => s.historicoBurnout);
  const carregado = useBemEstarStore((s) => s.carregado);
  const carregarTudo = useBemEstarStore((s) => s.carregarTudo);
  const conteudoDensoBloqueado = useBemEstarStore((s) => s.conteudoDensoBloqueado);
  const reiniciarIndice = useBemEstarStore((s) => s.reiniciarIndice);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [confirmandoReset, setConfirmandoReset] = useState(false);

  useEffect(() => {
    if (!carregado) void carregarTudo();
  }, [carregado, carregarTudo]);

  function pedirReset() {
    if (!confirmandoReset) {
      setConfirmandoReset(true);
      window.setTimeout(() => setConfirmandoReset(false), 4000);
      return;
    }
    setConfirmandoReset(false);
    void reiniciarIndice();
  }

  if (!previsao) return null;

  const cor = COR_CLASSE[previsao.classe];
  const pausa = sugestaoPausa(previsao.classe);
  const serie = historicoBurnout.slice(-14);

  return (
    <section aria-labelledby="fadiga-titulo" className="painel rounded-2xl p-5 md:p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h2 id="fadiga-titulo" className="text-lg text-white">Índice de fadiga</h2>
          <p className="text-sm text-gray-500 mt-0.5">Medido pelo app com as suas últimas respostas e horários de estudo</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="numero text-[2rem] leading-none" style={{ color: cor }}>{previsao.score}</span>
          <span className="text-sm text-gray-500"> de 100</span>
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-folha-3 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${previsao.score}%`, background: cor }}
        />
      </div>

      <p className="text-sm font-medium" style={{ color: cor }}>
        {ROTULO_CLASSE[previsao.classe]}
      </p>

      {previsao.motivos.length > 0 && (
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          O que pesou: {previsao.motivos.join(' e ')}.
        </p>
      )}

      {serie.length > 1 && (
        <p className="text-xs text-gray-500 mt-4 mb-1.5">Últimos {serie.length} dias</p>
      )}
      {serie.length > 1 && (
        <div className="flex items-end gap-[3px] h-10" role="img" aria-label={`Índice nos últimos ${serie.length} dias: ${serie.map((d) => d.score).join(', ')}`}>
          {serie.map((d, i) => (
            <div
              key={`${d.data}-${i}`}
              className="flex-1 rounded-t-sm min-h-[3px]"
              style={{ height: `${Math.max(6, d.score)}%`, background: COR_CLASSE[d.classe] }}
              title={`${d.data}: ${d.score}`}
            />
          ))}
        </div>
      )}

      {conteudoDensoBloqueado && (
        <div className="mt-5 border-l-2 border-orange-400 pl-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-orange-300">
            <ShieldAlert size={15} aria-hidden="true" /> Conteúdo denso pausado
          </p>
          <p className="text-sm text-gray-300 mt-1 leading-relaxed">{pausa.texto}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setActiveTab('audio')} className="btn-secondary">
              Ouvir uma pílula de 3 min
            </button>
            <button onClick={() => setActiveTab('escudo')} className="btn-ghost">
              Ativar escudo
            </button>
          </div>
        </div>
      )}

      {/* Zerar fica no pé, pequeno e com confirmação: é raro e apaga o
          histórico do índice. */}
      <div className="mt-5 pt-3 border-t border-linha flex justify-end">
        <button
          onClick={pedirReset}
          title={confirmandoReset ? 'Toque de novo para confirmar' : 'Zerar o índice e recomeçar do zero'}
          aria-label={confirmandoReset ? 'Confirmar: zerar o índice de fadiga' : 'Zerar o índice de fadiga'}
          className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            confirmandoReset ? 'text-red-300 bg-red-500/15' : 'text-gray-500 hover:text-gray-200 hover:bg-folha-2'
          }`}
        >
          <RotateCcw size={13} aria-hidden="true" />
          {confirmandoReset ? 'Toque de novo para zerar' : 'Zerar índice'}
        </button>
      </div>
    </section>
  );
}
