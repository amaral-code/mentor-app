import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DiaCalendario {
  dia: number;
  temSessao: boolean;
  ehHoje: boolean;
  /** Dia-resíduo do mês anterior: cinzento, sem clique. */
  foraDoMes?: boolean;
}

export type TomFeedback = 'neutro' | 'ambar' | 'emerald';

export interface FeedbackDia {
  titulo: string;
  detalhe: string;
  tom: TomFeedback;
  confirmado: boolean;
}

interface CalendarioProps {
  tituloMes: string;
  dias: (DiaCalendario | null)[];
  selecionado: number | null;
  onSelecionar: (dia: number) => void;
  feedback: FeedbackDia;
  onMesAnterior: () => void;
  onMesProximo: () => void;
}

const CLASSE_FEEDBACK: Record<TomFeedback, string> = {
  neutro: 'bg-midnight-800/80 border-midnight-700',
  ambar: 'bg-amber-500/10 border-amber-500/40',
  emerald: 'bg-emerald-500/10 border-emerald-500/40',
};

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/**
 * Calendário de acolhimento (protótipo 1:1 na estrutura): navegação de
 * mês, banner de feedback do dia selecionado e matriz de dias com
 * destaque para hoje/futuras. A matriz aqui é gerada de verdade para
 * qualquer mês, a partir das sessões reais.
 */
export function Calendario({
  tituloMes,
  dias,
  selecionado,
  onSelecionar,
  feedback,
  onMesAnterior,
  onMesProximo,
}: CalendarioProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarDays size={20} className="text-amber-400" />
            Calendário de Acolhimento
          </h3>
          <p className="text-xs text-slate-400" id="calendar-month-subtitle">{tituloMes}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Mês anterior"
            onClick={onMesAnterior}
            id="btn-prev-month"
            className="p-1.5 rounded-lg bg-midnight-800 text-slate-400 hover:text-white border border-midnight-700 hover:bg-midnight-750 transition active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className="text-xs font-semibold px-2 py-1 bg-midnight-800 rounded-lg text-slate-200 border border-midnight-700 select-none whitespace-nowrap"
            id="calendar-month-badge"
          >
            {tituloMes}
          </span>
          <button
            aria-label="Próximo mês"
            onClick={onMesProximo}
            id="btn-next-month"
            className="p-1.5 rounded-lg bg-midnight-800 text-slate-400 hover:text-white border border-midnight-700 hover:bg-midnight-750 transition active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="bg-midnight-850 rounded-2xl border border-midnight-750 p-5 shadow-lg relative">
        <div
          className={`mb-3 px-3 py-1.5 rounded-xl border flex items-center justify-between text-xs transition-all ${CLASSE_FEEDBACK[feedback.tom]}`}
          id="calendar-selected-feedback"
        >
          <span className="text-slate-300 flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${feedback.tom === 'neutro' ? 'bg-slate-500' : feedback.tom === 'ambar' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="truncate">
              <strong id="selected-day-text">{feedback.titulo}</strong>
              {feedback.detalhe}
            </span>
          </span>
          {feedback.confirmado && (
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider shrink-0 ml-2">Confirmado</span>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 pb-3 border-b border-midnight-700/60 mb-3">
          {DIAS_SEMANA.map((d, i) => (
            <span key={d} className={i === 3 ? 'text-amber-400' : ''}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium" id="calendar-days-container">
          {dias.map((info, i) => {
            if (!info) {
              return <div key={`vazio-${i}`} className="py-2.5 text-slate-600 rounded-xl is-empty" />;
            }
            if (info.foraDoMes) {
              return <div key={`ant-${info.dia}`} className="py-2.5 text-slate-600 rounded-xl is-empty">{info.dia}</div>;
            }
            const ativo = selecionado === info.dia;
            if (info.ehHoje && info.temSessao) {
              return (
                <div
                  key={info.dia}
                  onClick={() => onSelecionar(info.dia)}
                  data-day={info.dia}
                  data-session="today"
                  id={`day-cell-${info.dia}`}
                  title="Sessão Confirmada Hoje!"
                  className={`day-cell py-2 rounded-xl bg-amber-500 text-midnight-950 font-black shadow-lg shadow-amber-500/25 relative ring-2 ring-amber-400 ring-offset-2 ring-offset-midnight-900 cursor-pointer ${ativo ? 'day-selected-ring' : ''}`}
                >
                  <span>{info.dia}</span>
                  <span className="block text-[9px] uppercase font-extrabold tracking-tighter">Hoje</span>
                </div>
              );
            }
            if (info.temSessao) {
              return (
                <div
                  key={info.dia}
                  onClick={() => onSelecionar(info.dia)}
                  data-day={info.dia}
                  id={`day-cell-${info.dia}`}
                  title={`Sessão Confirmada dia ${info.dia}`}
                  className={`day-cell py-2 rounded-xl bg-midnight-750 border-2 border-emerald-500/60 text-emerald-300 font-bold hover:bg-midnight-700 cursor-pointer relative ${ativo ? 'day-selected-ring' : ''}`}
                >
                  <span>{info.dia}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mx-auto mt-0.5 animate-pulse" />
                </div>
              );
            }
            return (
              <div
                key={info.dia}
                onClick={() => onSelecionar(info.dia)}
                data-day={info.dia}
                className={`day-cell py-2.5 text-slate-400 hover:bg-midnight-800 rounded-xl cursor-pointer ${ativo ? 'day-selected-ring bg-midnight-800' : ''}`}
              >
                {info.dia}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-midnight-700/60 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-amber-500 shadow-sm shadow-amber-500/40" />
            <span>Sessão Hoje</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md border-2 border-emerald-500/80 bg-midnight-750" />
            <span>Sessões Futuras</span>
          </div>
          <div className="text-slate-500 text-[11px]">
            Horário oficial de Brasília (BRT)
          </div>
        </div>
      </div>
    </div>
  );
}
