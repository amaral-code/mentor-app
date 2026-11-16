import { memo, type RefObject } from 'react';
import { BadgeCheck, Bookmark, Lightbulb, Link2, TriangleAlert } from 'lucide-react';
import type { ChatMessage } from '../../../shared/types';
import { TextoFormatado } from '../../../shared/ui/TextoFormatado';

interface ChatMessagesProps {
  messages: ChatMessage[];
  /** Texto parcial da resposta em streaming (bolha do protótipo + cursor). */
  streamingText: string | null;
  streamingModo: 'explicativo' | 'comunicativo';
  isGenerating: boolean;
  /** Inicial do aluno para o avatar (ex.: "M"). */
  userInicial: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSaveNota: (msg: ChatMessage) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

function formatarHora(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Lista de mensagens (protótipo AGcode 1:1): bolha do aluno em gradiente
 * índigo com avatar inicial, bolha do Mentor Sagui com cabeçalho
 * (Mentor ENEM + horário + selo Didático/Macete Rápido).
 *
 * Memorizada: o pai (ChatPage) faz setState a cada tecla no input e a cada
 * tick do streaming (24ms). Sem memo, cada um desses renders recriava a
 * arvore inteira de mensagens; com memo + TextoFormatado memorizado, o
 * React reaproveita tudo e so renderiza o balao de streaming.
 */
export const ChatMessages = memo(function ChatMessages({
  messages,
  streamingText,
  streamingModo,
  isGenerating,
  userInicial,
  messagesEndRef,
  onSaveNota,
  hoveredId,
  onHover,
}: ChatMessagesProps) {
  return (
    <div className="w-full max-w-4xl space-y-4 flex flex-col pb-4" id="messagesList">
      {messages.map((msg) =>
        msg.role === 'user' ? (
          <div
            key={msg.id}
            className="flex items-start justify-end gap-2.5 self-end max-w-[85%] animate-slide-up"
            onMouseEnter={() => onHover(msg.id)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="min-w-0">
              <div className="bg-azul-600 rounded-[18px] rounded-br-md px-4 py-3 text-base text-white shadow-lip-azul">
                {msg.image && (
                  <div className="mb-2 rounded-xl overflow-hidden border border-slate-200">
                    <img src={msg.image} alt="Foto da questão" className="w-full h-auto max-h-56 object-cover" />
                  </div>
                )}
                {msg.text && (
                  <TextoFormatado texto={msg.text} className="text-[15px] font-semibold text-white leading-relaxed" />
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-1.5">
                <span className="text-[10px] text-slate-500 font-mono">{formatarHora(msg.timestamp)}</span>
                <button
                  onClick={() => onSaveNota(msg)}
                  title="Salvar no Caderno"
                  aria-label="Salvar mensagem no Caderno"
                  className={`transition-all duration-200 p-1 -m-1 ${hoveredId === msg.id ? 'text-amber-600 opacity-100' : 'text-slate-500 opacity-100 md:opacity-0'}`}
                >
                  <Bookmark size={14} />
                </button>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-ceu-500 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
              {userInicial}
            </div>
          </div>
        ) : (
          <div
            key={msg.id}
            className="flex items-start gap-3 self-start max-w-[90%] animate-slide-up"
            onMouseEnter={() => onHover(msg.id)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-azul-100 border-2 border-white flex-shrink-0 mt-0.5">
              <img
                src="/assets/ele_feliz_pulando.png"
                alt="Sagui"
                width={36}
                height={36}
                loading="lazy"
                draggable={false}
                onError={(e) => { if (e.currentTarget.src.endsWith('ele_feliz_pulando.png')) e.currentTarget.src = '/assets/sagui_pulando_2.png'; }}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="min-w-0 bg-white border-2 border-slate-200 rounded-[18px] rounded-tl-md p-4 text-sm text-tinta-700 shadow-lip leading-relaxed">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-slate-100">
                <span className="font-extrabold text-azul-600 text-sm flex items-center gap-1.5">
                  <Lightbulb size={14} className="text-amber-500" />
                  Mentor ENEM
                </span>
                <span className="text-[10px] text-slate-600 font-mono">{formatarHora(msg.timestamp)}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto font-extrabold whitespace-nowrap">
                  {(msg.modoResposta ?? msg.modoChat) === 'comunicativo' ? 'Macete Rápido' : 'Didático'}
                </span>
              </div>
              {msg.text ? (
                <TextoFormatado texto={msg.text} className="text-[15px] text-tinta-900 leading-relaxed" />
              ) : (
                <p className="text-sm text-slate-600 italic">Resposta vazia da IA. Tente enviar de novo.</p>
              )}
              {msg.role === 'assistant' && (msg.fontes?.length || msg.citouProva) && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  {msg.citouProva && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        msg.groundingUsado ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {msg.groundingUsado ? <BadgeCheck size={11} /> : <TriangleAlert size={11} />}
                      {msg.groundingUsado ? 'Questão conferida na fonte' : 'Citou prova sem fonte verificada'}
                    </span>
                  )}
                  {!!msg.fontes?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.fontes.slice(0, 4).filter((f) => { try { return new URL(f.uri).protocol === 'https:'; } catch { return false; } }).map((f) => (
                        <a
                          key={f.uri}
                          href={f.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={f.titulo}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-[10px] text-slate-600 hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors max-w-[190px]"
                        >
                          <Link2 size={10} className="shrink-0" />
                          <span className="truncate">{f.dominio}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end mt-2">
                <button
                  onClick={() => onSaveNota(msg)}
                  title="Salvar no Caderno"
                  aria-label="Salvar resposta no Caderno"
                  className={`transition-all duration-200 p-1 -m-1 ${hoveredId === msg.id ? 'text-amber-600 opacity-100' : 'text-slate-500 opacity-100 md:opacity-0'}`}
                >
                  <Bookmark size={14} />
                </button>
              </div>
            </div>
          </div>
        ),
      )}

      {/* Resposta em streaming: mesma estrutura do balão do Mentor + cursor. */}
      {streamingText !== null && (
        <div className="flex items-start gap-3 self-start max-w-[90%]">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-azul-100 border-2 border-white flex-shrink-0 mt-0.5">
            <img
              src="/assets/ele_feliz_pulando.png"
              alt="Sagui"
              width={36}
              height={36}
              draggable={false}
              onError={(e) => { if (e.currentTarget.src.endsWith('ele_feliz_pulando.png')) e.currentTarget.src = '/assets/sagui_pulando_2.png'; }}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="min-w-0 bg-white border-2 border-slate-200 rounded-[18px] rounded-tl-md p-4 text-sm text-tinta-700 shadow-lip leading-relaxed">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-slate-100">
              <span className="font-extrabold text-azul-600 text-sm flex items-center gap-1.5">
                <Lightbulb size={14} className="text-amber-500" />
                Mentor ENEM
              </span>
              <span className="text-[10px] text-slate-600">digitando…</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto font-extrabold whitespace-nowrap">
                {streamingModo === 'explicativo' ? 'Didático' : 'Macete Rápido'}
              </span>
            </div>
            <TextoFormatado texto={streamingText} className="text-[15px] text-tinta-900 leading-relaxed" />
            <span className="inline-block w-2 h-4 bg-ceu-500 animate-pulse rounded-[2px] ml-0.5" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Digitando (antes do primeiro chunk chegar). */}
      {isGenerating && streamingText === null && (
        <div className="flex items-start gap-3 self-start max-w-[90%]">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-azul-100 border-2 border-white flex-shrink-0 mt-0.5 mascot-assist-idle">
            <img
              src="/assets/ele_feliz_pulando.png"
              alt="Sagui digitando"
              width={36}
              height={36}
              loading="lazy"
              draggable={false}
              onError={(e) => { if (e.currentTarget.src.endsWith('ele_feliz_pulando.png')) e.currentTarget.src = '/assets/sagui_pulando_2.png'; }}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2.5">
            <span className="text-sm text-slate-600">Sagui está digitando</span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
});
