import { useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Lock, Send } from 'lucide-react';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import type { MensagemApoio } from '../../shared/storage/PsicologiaRepository';

/**
 * UMA CONVERSA, DUAS PONTAS.
 *
 * O mesmo componente serve ao aluno, ao responsável e ao psicólogo. O
 * que muda é quem está de cada lado, e a RLS garante que ninguém além
 * dessas duas pessoas leia a conversa: nem o responsável lê a do filho,
 * nem o filho lê a do responsável.
 *
 * O AVISO DE EMERGÊNCIA fica sempre visível, e não num rodapé que some.
 * Mensagem entre sessões não tem plantão: o psicólogo pode ler horas
 * depois. Quem escreve numa crise precisa saber disso ANTES de enviar, e
 * saber para onde ligar.
 */

interface Props {
  psicologoId: string;
  participanteId: string;
  /** Quem está logado: decide de que lado cada balão fica. */
  meuId: string;
  titulo: string;
  /** Sem vínculo vigente o histórico continua legível, mas não se envia. */
  ativa: boolean;
  /** O psicólogo não precisa do aviso de emergência: é ele quem atende. */
  mostrarAvisoEmergencia?: boolean;
}

const LIMITE = 4000;

export function Conversa({ psicologoId, participanteId, meuId, titulo, ativa, mostrarAvisoEmergencia = true }: Props) {
  const [mensagens, setMensagens] = useState<MensagemApoio[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setMensagens(await psicologiaRepository.mensagens(psicologoId, participanteId));
    void psicologiaRepository.marcarLida(psicologoId, participanteId);
  }, [psicologoId, participanteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length]);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo || enviando || !ativa) return;
    setEnviando(true);
    setErro('');
    try {
      await psicologiaRepository.enviar(psicologoId, participanteId, limpo);
      setTexto('');
      await carregar();
    } catch (e) {
      const bruto = (e instanceof Error ? e.message : '').toLowerCase();
      setErro(
        bruto.includes('sem_vinculo')
          ? 'O acesso entre vocês foi encerrado. O histórico continua aqui, mas não dá para enviar.'
          : 'Não foi possível enviar agora. Tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white truncate">{titulo}</h3>
        <span className="text-[10px] text-gray-500 inline-flex items-center gap-1 shrink-0">
          <Lock size={11} /> só vocês dois leem
        </span>
      </div>

      {mostrarAvisoEmergencia && (
        <div className="px-4 py-2.5 bg-rose-500/[0.06] border-b border-rose-500/15 flex gap-2 items-start" role="note">
          <LifeBuoy size={14} className="text-rose-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-rose-200/90 leading-relaxed">
            Este canal não é de emergência: a resposta pode levar horas. Se você está em
            crise agora, ligue <strong>188</strong> (CVV, 24 horas, gratuito) ou <strong>192</strong> (SAMU).
          </p>
        </div>
      )}

      <div className="px-4 py-4 space-y-2.5 max-h-[420px] min-h-[180px] overflow-y-auto" aria-live="polite">
        {mensagens.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Nenhuma mensagem ainda.</p>
        ) : (
          mensagens.map((m) => {
            const minha = m.autorId === meuId;
            return (
              <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    minha
                      ? 'bg-cyan-500/15 text-cyan-50 border border-cyan-500/20 rounded-br-md'
                      : 'bg-white/[0.05] text-gray-200 border border-white/[0.06] rounded-bl-md'
                  }`}
                >
                  {m.texto}
                  <span className="block text-[10px] text-gray-500 mt-1 text-right tabular-nums">
                    {new Date(m.criadoEm).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {ativa ? (
        <div className="px-3 py-3 border-t border-white/[0.05]">
          <div className="flex gap-2 items-end">
            <label htmlFor={`msg-${psicologoId}-${participanteId}`} className="sr-only">
              Escreva uma mensagem
            </label>
            <textarea
              id={`msg-${psicologoId}-${participanteId}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, LIMITE))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={2}
              placeholder="Escreva uma mensagem"
              className="flex-1 resize-none px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/40"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              aria-label="Enviar mensagem"
              className="btn-primary !px-3.5 h-11 inline-flex items-center justify-center disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
          {erro && (
            <p role="alert" className="text-xs text-red-400 mt-2">
              {erro}
            </p>
          )}
        </div>
      ) : (
        <p className="px-4 py-3 border-t border-white/[0.05] text-xs text-gray-500">
          O acesso entre vocês foi encerrado. O histórico continua legível, mas não dá mais para enviar.
        </p>
      )}
    </div>
  );
}
