import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from '../../shared/ui/Modal';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import {
  agruparPorDia,
  formatarHora,
  formatarPreco,
  gerarSlots,
  politicaCancelamento,
} from '../../shared/lib/bookingEngine';
import type { Psicologo, SlotAgenda } from '../../shared/types';

interface BookingModalProps {
  psicologo: Psicologo | null;
  /** Para quem e a consulta (o proprio aluno ou o filho vinculado). */
  aluno: { id: string; nome: string } | null;
  /** Alerta que originou a busca, para amarrar consulta e gatilho. */
  alertaId?: string | null;
  onClose: () => void;
}

/**
 * Fluxo de agendamento em tres passos numa tela so: dia, horario,
 * confirmacao. Passo unico e proposital - o responsavel chega aqui
 * depois de um alerta de saude mental, e um funil de tres telas perde
 * gente exatamente no momento em que ela decidiu agir.
 *
 * A lista de horarios vem do banco (slots_livres). Se estiver vazia por
 * falha de rede, cai para o calculo local sobre as janelas semanais -
 * assim a tela nao mente dizendo "sem horarios" quando o profissional
 * atende a semana inteira.
 */
export function BookingModal({ psicologo, aluno, alertaId, onClose }: BookingModalProps) {
  const slots = useMarketplaceStore((s) => s.slots);
  const disponibilidade = useMarketplaceStore((s) => s.disponibilidade);
  const carregarAgenda = useMarketplaceStore((s) => s.carregarAgenda);
  const contratar = useMarketplaceStore((s) => s.contratar);
  const processandoPagamento = useMarketplaceStore((s) => s.processandoPagamento);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [slotSelecionado, setSlotSelecionado] = useState<SlotAgenda | null>(null);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);

  useEffect(() => {
    if (!psicologo) return;
    setDiaSelecionado(null);
    setSlotSelecionado(null);
    setCarregandoAgenda(true);
    void carregarAgenda(psicologo.id).finally(() => setCarregandoAgenda(false));
  }, [psicologo?.id]);

  const dias = useMemo(() => {
    if (!psicologo) return [];
    const doBanco = slots[psicologo.id] ?? [];
    const lista = doBanco.length
      ? doBanco
      : gerarSlots(disponibilidade[psicologo.id] ?? [], psicologo.duracaoMinutos);
    return agruparPorDia(lista);
  }, [psicologo, slots, disponibilidade]);

  useEffect(() => {
    if (!diaSelecionado && dias.length > 0) setDiaSelecionado(dias[0].data);
  }, [dias, diaSelecionado]);

  if (!psicologo) return null;

  const doDia = dias.find((d) => d.data === diaSelecionado)?.slots ?? [];
  const politica = slotSelecionado ? politicaCancelamento(slotSelecionado.inicio) : null;

  async function confirmar() {
    if (!slotSelecionado || !aluno || !psicologo) return;
    const resultado = await contratar(psicologo, aluno.id, slotSelecionado, alertaId);
    if (resultado) onClose();
  }

  return (
    <Modal open={!!psicologo} onClose={onClose} title="Agendar atendimento">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-600/10 flex items-center justify-center text-violet-300 font-bold text-lg shrink-0">
            {psicologo.nome.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{psicologo.nome}</p>
            <p className="text-[11px] text-gray-500">
              CRP {psicologo.crp} · {psicologo.duracaoMinutos} min por sessão
            </p>
            <p className="text-sm font-semibold text-amber-400 mt-1 tabular-nums">
              {formatarPreco(psicologo.valorCentavos)}
            </p>
          </div>
        </div>

        {aluno && (
          <p className="text-xs text-gray-500">
            Atendimento para <strong className="text-gray-300">{aluno.nome}</strong>.
          </p>
        )}

        {carregandoAgenda ? (
          <p className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
            <Loader2 size={15} className="animate-spin" /> Buscando horarios livres...
          </p>
        ) : dias.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            Este profissional nao tem horarios abertos nos proximos 14 dias.
          </p>
        ) : (
          <>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <CalendarClock size={13} /> Dia
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dias.map((d) => (
                  <button
                    key={d.data}
                    onClick={() => {
                      setDiaSelecionado(d.data);
                      setSlotSelecionado(null);
                    }}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border ${
                      diaSelecionado === d.data
                        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                        : 'border-white/[0.04] glass-light text-gray-400'
                    }`}
                  >
                    {d.rotulo}
                    <span className="block text-[10px] text-gray-500 mt-0.5">{d.slots.length} horarios</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Horario</p>
              <div className="grid grid-cols-4 gap-2">
                {doDia.map((s) => (
                  <button
                    key={s.inicio}
                    onClick={() => setSlotSelecionado(s)}
                    className={`py-2 rounded-xl text-xs font-semibold tabular-nums border ${
                      slotSelecionado?.inicio === s.inicio
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                        : 'border-white/[0.04] glass-light text-gray-300 hover:border-white/[0.1]'
                    }`}
                  >
                    {formatarHora(s.inicio)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {politica && (
          <div className="rounded-xl glass-light p-3 space-y-1.5">
            <p className="text-xs text-gray-300 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" /> {politica.texto}
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              O link da sala de video e criado automaticamente quando o pagamento e confirmado e aparece
              na agenda do estudante e do profissional.
            </p>
          </div>
        )}

        <button
          onClick={confirmar}
          disabled={!slotSelecionado || !aluno || processandoPagamento}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {processandoPagamento ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Abrindo pagamento...
            </>
          ) : (
            <>
              <CreditCard size={16} /> Pagar {formatarPreco(psicologo.valorCentavos)} e agendar
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
