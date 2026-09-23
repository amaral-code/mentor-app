import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import type { Conversa as ConversaInfo } from '../../shared/storage/PsicologiaRepository';
import { Conversa } from './Conversa';

/**
 * MENSAGENS COM O PSICÓLOGO — lado do aluno e do responsável.
 *
 * `meuId` é sempre a ponta "participante". A lista junta duas fontes:
 * as conversas que já existem e os profissionais com quem existe
 * consulta, para dar para começar uma conversa sem esperar o psicólogo
 * escrever primeiro.
 */

interface Props {
  meuId: string;
  /** Profissionais com quem há consulta: podem virar conversa nova. */
  psicologos: { id: string; nome: string }[];
}

export function CaixaMensagens({ meuId, psicologos }: Props) {
  const [conversas, setConversas] = useState<ConversaInfo[]>([]);
  const [aberta, setAberta] = useState<{ psicologoId: string; nome: string; ativa: boolean } | null>(null);

  const carregar = useCallback(async () => {
    const todas = await psicologiaRepository.conversas();
    setConversas(todas.filter((c) => c.participanteId === meuId));
  }, [meuId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const itens = useMemo(() => {
    const porPsico = new Map(conversas.map((c) => [c.psicologoId, c]));
    const lista = conversas.map((c) => ({
      psicologoId: c.psicologoId,
      nome: c.outroNome,
      ultima: c.ultimaTexto,
      naoLidas: c.naoLidas,
      ativa: c.ativa,
    }));
    for (const p of psicologos) {
      if (!porPsico.has(p.id)) {
        lista.push({ psicologoId: p.id, nome: p.nome, ultima: '', naoLidas: 0, ativa: true });
      }
    }
    return lista;
  }, [conversas, psicologos]);

  if (aberta) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setAberta(null);
            void carregar();
          }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-cyan-300 min-h-[40px]"
        >
          <ArrowLeft size={15} /> Todas as conversas
        </button>
        <Conversa
          psicologoId={aberta.psicologoId}
          participanteId={meuId}
          meuId={meuId}
          titulo={aberta.nome}
          ativa={aberta.ativa}
        />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-3">
        <MessageCircle size={16} className="text-cyan-400" /> Mensagens com o psicólogo
      </h2>

      {itens.length === 0 ? (
        <p className="text-sm text-gray-500 glass-light rounded-xl px-3.5 py-3">
          As conversas aparecem aqui depois da primeira consulta marcada.
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((i) => (
            <li key={i.psicologoId}>
              <button
                type="button"
                onClick={() => setAberta({ psicologoId: i.psicologoId, nome: i.nome, ativa: i.ativa })}
                className="w-full text-left glass-light rounded-xl px-3.5 py-3 border border-white/[0.04] hover:border-cyan-500/30 transition-all flex items-center justify-between gap-3 min-h-[56px]"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-white font-medium truncate">{i.nome}</span>
                  <span className="block text-xs text-gray-500 truncate mt-0.5">
                    {/* A prévia repete só o que já está na tela de quem abriu
                        o app. A notificação do celular nunca traz o texto. */}
                    {i.ultima || 'Começar uma conversa'}
                  </span>
                </span>
                {i.naoLidas > 0 && (
                  <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-cyan-400 text-gray-900 text-[11px] font-bold flex items-center justify-center tabular-nums">
                    {i.naoLidas}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
