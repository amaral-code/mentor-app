import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import type { Conversa as ConversaInfo } from '../../shared/storage/PsicologiaRepository';
import { Conversa } from '../psicologia/Conversa';

/**
 * Todas as conversas do profissional: com estudantes e com responsáveis,
 * cada uma separada. O rótulo diz quem está do outro lado, porque
 * responder ao responsável achando que é o aluno (ou o contrário) é o
 * erro que este canal não pode permitir.
 */
export function ConversasProfissional({ meuId, idsPacientes }: { meuId: string; idsPacientes: Set<string> }) {
  const [conversas, setConversas] = useState<ConversaInfo[]>([]);
  const [aberta, setAberta] = useState<ConversaInfo | null>(null);

  const carregar = useCallback(async () => {
    const todas = await psicologiaRepository.conversas();
    setConversas(todas.filter((c) => c.psicologoId === meuId));
  }, [meuId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const quem = (c: ConversaInfo) => (idsPacientes.has(c.participanteId) ? 'estudante' : 'responsável');

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
          psicologoId={meuId}
          participanteId={aberta.participanteId}
          meuId={meuId}
          titulo={`${aberta.outroNome} (${quem(aberta)})`}
          ativa={aberta.ativa}
          mostrarAvisoEmergencia={false}
        />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-3">
        <MessageCircle size={16} className="text-cyan-400" /> Mensagens
      </h2>
      {conversas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma conversa ainda.</p>
      ) : (
        <ul className="space-y-2">
          {conversas.map((c) => (
            <li key={`${c.psicologoId}-${c.participanteId}`}>
              <button
                type="button"
                onClick={() => setAberta(c)}
                className="w-full text-left glass-light rounded-xl px-3.5 py-3 border border-white/[0.04] hover:border-cyan-500/30 transition-all flex items-center justify-between gap-3 min-h-[56px]"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-white font-medium truncate">
                    {c.outroNome}{' '}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        quem(c) === 'estudante' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-violet-500/10 text-violet-300'
                      }`}
                    >
                      {quem(c)}
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500 truncate mt-0.5">{c.ultimaTexto}</span>
                </span>
                {c.naoLidas > 0 && (
                  <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-cyan-400 text-gray-900 text-[11px] font-bold flex items-center justify-center tabular-nums">
                    {c.naoLidas}
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
