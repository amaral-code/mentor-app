import { ArrowRight, Check, Clock, Lock, Video } from 'lucide-react';
import { formatarDataHora, iniciais, type SessaoView } from '../tipos';

interface SessoesListaProps {
  proximas: SessaoView[];
  passadas: SessaoView[];
  destaqueId: string | null;
  onBuscarPsicologo: () => void;
}

function diasAte(d: Date): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

/**
 * Lista de sessões (protótipo 1:1): cards das próximas com link da sala,
 * card de sigilo e histórico de realizadas. Sem sessões, vira um convite
 * para buscar um profissional — nunca tela vazia.
 */
export function SessoesLista({ proximas, passadas, destaqueId, onBuscarPsicologo }: SessoesListaProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock size={20} className="text-amber-400" />
          Próximas Sessões
        </h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-midnight-750 text-slate-300 border border-midnight-700 tabular-nums">
          {proximas.length} Confirmada{proximas.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-3.5" data-purpose="session-cards-list">
        {proximas.length === 0 && (
          <div className="p-5 rounded-2xl bg-midnight-850 border border-dashed border-midnight-600 text-center">
            <p className="text-sm font-semibold text-white">Nenhuma sessão agendada</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Escolha um profissional e marque seu primeiro momento de escuta.
            </p>
            <button
              onClick={onBuscarPsicologo}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-midnight-950 font-extrabold text-sm transition-all active:scale-95"
            >
              Buscar psicólogo
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        {proximas.map((s) => {
          const destaque = destaqueId === s.id;
          const dias = diasAte(s.inicio);
          const eHoje = s.ehHoje;
          return (
            <div
              key={s.id}
              id={`session-card-${s.id}`}
              className={`p-4 rounded-2xl relative overflow-hidden transition-all duration-300 ${
                eHoje
                  ? 'bg-midnight-850 border border-amber-500/40 hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-500/10'
                  : 'bg-midnight-850/80 border border-midnight-750 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5'
              } ${destaque ? `ring-2 ${eHoje ? 'ring-amber-400' : 'ring-emerald-400'} scale-[1.02]` : ''}`}
            >
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${eHoje ? 'bg-amber-500' : 'bg-slate-600'}`} />
              <div className="flex items-start justify-between gap-3 pl-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-midnight-700 flex-shrink-0 border border-midnight-600 flex items-center justify-center">
                    <span className="text-sm font-extrabold text-emerald-200" aria-hidden="true">
                      {iniciais(s.psicologoNome)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    {eHoje ? (
                      <span className="inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tabular-nums">
                        Hoje às {s.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-semibold text-slate-400">
                        {formatarDataHora(s.inicio)}
                      </span>
                    )}
                    <h5 className="text-sm font-bold text-white mt-1 truncate">{s.psicologoNome}</h5>
                    <p className="text-xs text-slate-400 truncate">{s.crp} • {s.duracaoMinutos} minutos</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                  Confirmada
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-midnight-700/60 flex items-center justify-between pl-1 gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Video size={14} className="text-slate-500" />
                  {eHoje ? (s.meetingUrl?.includes('jitsi') ? 'Jitsi Meet' : 'Google Meet') : 'Sala liberada no dia'}
                </span>
                {eHoje ? (
                  <a
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-transform hover:translate-x-1"
                    href={s.meetingUrl ?? 'https://meet.google.com'}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Acessar Link
                    <ArrowRight size={14} />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500 font-medium tabular-nums">
                    Link será ativado em {dias} dia{dias === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-midnight-950 border border-midnight-750/80 text-xs text-slate-400 space-y-2 transition-all hover:border-midnight-700">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Lock size={16} className="text-emerald-400" />
          <span>Seu espaço é 100% protegido</span>
        </div>
        <p className="leading-relaxed">
          Tudo o que você disser durante a videochamada é estritamente confidencial, resguardado pelo sigilo profissional do Código de Ética dos Psicólogos (CFP/CRP).
        </p>
      </div>

      <section className="pt-8 border-t border-midnight-750/70" data-purpose="past-sessions-history">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              Sessões Realizadas Anteriormente
            </h3>
            <p className="text-xs text-slate-400">Histórico de encontros concluídos com sua psicóloga</p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{passadas.length} sessão{passadas.length === 1 ? '' : 'ões'} realizada{passadas.length === 1 ? '' : 's'}</span>
        </div>
        {passadas.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma sessão concluída ainda. As realizadas aparecem aqui.</p>
        ) : (
          <div className="space-y-3">
            {passadas.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-midnight-850/60 border border-midnight-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:border-midnight-600 hover:bg-midnight-850"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-midnight-750 flex items-center justify-center text-emerald-400 border border-midnight-700 shadow-sm shrink-0">
                    <Check size={20} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-sm font-semibold text-white truncate">Sessão com {s.psicologoNome}</h5>
                    <p className="text-xs text-slate-400">
                      {s.inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} • {s.duracaoMinutos} min • Concluída
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Presença confirmada
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
