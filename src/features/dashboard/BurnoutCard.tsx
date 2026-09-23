import { useEffect, useState } from 'react';
import { Activity, RotateCcw, ShieldAlert } from 'lucide-react';
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
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${cor}1a` }}
        >
          <Activity size={18} style={{ color: cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-300">Índice de fadiga</h2>
          <p className="text-[11px] text-gray-500">Calculado com as suas últimas respostas e horários</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-extrabold tabular-nums" style={{ color: cor }}>
            {previsao.score}
          </p>
          <p className="text-[10px] text-gray-500">/100</p>
        </div>
        <button
          onClick={pedirReset}
          title={confirmandoReset ? 'Clique de novo para confirmar' : 'Zerar índice e recomeçar do zero'}
          aria-label={confirmandoReset ? 'Confirmar reinício do índice' : 'Reiniciar índice de fadiga'}
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all active:scale-95 ${
            confirmandoReset
              ? 'text-red-300 bg-red-500/15'
              : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'
          }`}
        >
          <RotateCcw size={12} />
          {confirmandoReset ? 'Zerar?' : 'Reiniciar'}
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-3">
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
        <div className="flex items-end gap-[3px] h-10 mt-4" aria-hidden="true">
          {serie.map((d, i) => (
            <div
              key={`${d.data}-${i}`}
              className="flex-1 rounded-t-sm min-h-[3px]"
              style={{ height: `${Math.max(6, d.score)}%`, background: COR_CLASSE[d.classe], opacity: 0.75 }}
              title={`${d.data}: ${d.score}`}
            />
          ))}
        </div>
      )}

      {conteudoDensoBloqueado && (
        <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.07] p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-orange-300">
            <ShieldAlert size={14} /> Conteúdo denso pausado
          </p>
          <p className="text-xs text-orange-200/70 mt-1.5 leading-relaxed">{pausa.texto}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setActiveTab('audio')} className="btn-secondary !px-3 !py-2 text-xs">
              Ouvir uma pílula de 3 min
            </button>
            <button onClick={() => setActiveTab('escudo')} className="btn-ghost !px-3 !py-2 text-xs text-gray-400">
              Ativar escudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
