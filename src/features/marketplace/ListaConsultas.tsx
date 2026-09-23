import { useEffect, useState } from 'react';
import { CalendarClock, CircleCheck, Clock, Video } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import {
  ehLinkDeSalaValido,
  formatarDataHora,
  formatarPreco,
  politicaCancelamento,
  salaEstaAberta,
  tempoAte,
} from '../../shared/lib/bookingEngine';
import { EmptyState } from '../../shared/ui/EmptyState';
import { useAppStore } from '../../stores/appStore';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import { AvaliarConsulta } from './AvaliarConsulta';

/**
 * Consultas do usuario logado (como aluno, responsavel ou psicologo -
 * a RLS ja devolve so o que lhe diz respeito).
 *
 * O botao de ENTRAR NA SALA so aparece dez minutos antes do horario. Um
 * link ativo o tempo todo faz o aluno clicar no dia errado, cair numa
 * sala vazia e concluir que "nao funciona".
 */
export function ListaConsultas({ compacto = false }: { compacto?: boolean }) {
  const agendamentos = useMarketplaceStore((s) => s.agendamentos);
  const carregarConsultas = useMarketplaceStore((s) => s.carregarConsultas);
  const cancelar = useMarketplaceStore((s) => s.cancelar);
  const papel = useAppStore((s) => s.session?.role);
  // `null` enquanto carrega: sem isso as estrelas piscariam em consulta
  // que ja foi avaliada.
  const [avaliadas, setAvaliadas] = useState<Set<string> | null>(null);

  useEffect(() => {
    void carregarConsultas();
    void psicologiaRepository.consultasAvaliadas().then(setAvaliadas);
  }, []);

  /* Quem avalia e quem foi atendido. O profissional nao se avalia, e
     consulta de falta nao diz nada sobre ele. */
  const podeAvaliar = (a: { id: string; fim: string; status: string }) =>
    papel !== 'psychologist' &&
    avaliadas !== null &&
    !avaliadas.has(a.id) &&
    a.status !== 'no_show' &&
    new Date(a.fim).getTime() < Date.now();

  const ativas = agendamentos
    .filter((a) => a.status !== 'cancelado')
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  if (ativas.length === 0) {
    return compacto ? null : (
      <div className="glass rounded-2xl p-5">
        <EmptyState
          pose="meditando"
          compacto
          titulo="Nenhuma consulta agendada"
          descricao="Quando um atendimento for marcado, o horário e o link da sala aparecem aqui."
        />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <CalendarClock size={16} className="text-violet-400" /> Consultas
      </h2>

      <div className="space-y-2.5">
        {ativas.map((a) => {
          const aberta = salaEstaAberta(a);
          const temLink = ehLinkDeSalaValido(a.meetingUrl);
          const politica = politicaCancelamento(a.inicio);

          return (
            <div key={a.id} className="rounded-xl glass-light border border-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Quem atende procura o PACIENTE; quem é atendido, o
                      profissional. Antes o psicólogo via o próprio nome
                      primeiro e o do paciente cortado ("Miguel..."). */}
                  <p className="text-sm font-medium text-white truncate">
                    {papel === 'psychologist'
                      ? (a.alunoNome ?? 'Paciente')
                      : `${a.psicologoNome ?? 'Profissional'}${papel === 'parent' && a.alunoNome ? ` · ${a.alunoNome}` : ''}`}
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <Clock size={11} /> {formatarDataHora(a.inicio)} · {tempoAte(a.inicio)}
                  </p>
                </div>

                {/* `isento` (consulta sem custo) aparecia como "pagamento
                    pendente": o selo so conhecia `pago`. */}
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    a.statusPagamento === 'pago' || a.statusPagamento === 'isento'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {a.statusPagamento === 'pago'
                    ? 'pago'
                    : a.statusPagamento === 'isento'
                      ? 'sem custo'
                      : 'pagamento pendente'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-3">
                <span className="text-[11px] text-gray-500 tabular-nums">
                  {formatarPreco(a.valorCentavos)}
                </span>

                <div className="flex items-center gap-2">
                  {politica.podeCancelar && (
                    <button
                      onClick={() => cancelar(a.id)}
                      className="btn-ghost !px-2.5 !py-1.5 text-[11px] text-gray-500 hover:text-red-400"
                      title={politica.texto}
                    >
                      Cancelar
                    </button>
                  )}

                  {/* Consulta que ja terminou mostrava "sala pronta", como se
                      ainda desse para entrar. */}
                  {new Date(a.fim).getTime() < Date.now() ? (
                    <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                      <CircleCheck size={12} className="text-gray-500" /> realizada
                    </span>
                  ) : temLink && aberta ? (
                    <a
                      href={a.meetingUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                    >
                      <Video size={13} /> Entrar na sala
                    </a>
                  ) : temLink ? (
                    <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                      <CircleCheck size={12} className="text-emerald-400" /> sala pronta
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-600">sala após o pagamento</span>
                  )}
                </div>
              </div>

              {podeAvaliar(a) && (
                <AvaliarConsulta
                  agendamentoId={a.id}
                  aoAvaliar={() => setAvaliadas((atual) => new Set(atual ?? []).add(a.id))}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
