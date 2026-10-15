import { memo, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import { BookOpen, Camera, MessageSquareText, Mic, Send } from 'lucide-react';

export type ModoRespostaUI = 'explicativo' | 'comunicativo';

interface PremiumInputProps {
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onCamera: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onVoice: () => void;
  isListening: boolean;
  modoResposta: ModoRespostaUI;
  onTrocarModo: (m: ModoRespostaUI) => void;
  modeContainerRef: RefObject<HTMLDivElement | null>;
  registrarBotaoModo: (id: ModoRespostaUI, el: HTMLButtonElement | null) => void;
  modePill: { left: number; width: number };
  /** Pisca a borda neon ao preencher via card (fillPrompt do protótipo). */
  flashKey: number;
}

const MODOS = [
  { id: 'explicativo', label: 'Explicativo', desc: '• Passo a passo didático formal' },
  { id: 'comunicativo', label: 'Comunicativo', desc: '• Resposta direta e macetes práticos' },
] as const;

/**
 * Barra premium flutuante (protótipo AGcode 1:1): cyber glow, textarea,
 * OCR/voz/envio e switch segmentado Explicativo/Comunicativo com pílula.
 *
 * Memorizada junto ao pai: a digitacao muda `input` (re-render necessario
 * e barato, so desta barra), mas trocas de resto do chat (mensagem nova,
 * tick de streaming, toast) nao precisam recriar esta arvore.
 */
export const PremiumInput = memo(function PremiumInput({
  input,
  onChange,
  onSend,
  onKeyDown,
  inputRef,
  fileInputRef,
  onCamera,
  onFileChange,
  onVoice,
  isListening,
  modoResposta,
  onTrocarModo,
  modeContainerRef,
  registrarBotaoModo,
  modePill,
  flashKey,
}: PremiumInputProps) {
  return (
    <footer
      className="relative z-20 w-full flex justify-center bg-[#141310] pt-3 pb-1 shrink-0"
      data-purpose="chat-input-container"
    >
      <div
        className={`w-full max-w-3xl p-px rounded-2xl cyber-input-wrap ${flashKey > 0 ? 'input-flash' : ''}`}
        key={flashKey}
        id="inputWrapperBox"
      >
        <div className="w-full bg-folha rounded-[13px] p-2.5">
          <div className="flex items-center gap-2 px-1">
            <textarea
              ref={inputRef}
              id="userInput"
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escreva a dúvida ou cole o enunciado da questão"
              rows={1}
              aria-label="Mensagem para o Mentor"
              className="w-full !bg-transparent !border-0 resize-none text-gray-100 text-[0.9375rem] focus:ring-0 focus:outline-none !py-2 !px-1 leading-relaxed max-h-32 !min-h-0"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              onClick={onCamera}
              title="Digitalizar questão / OCR"
              aria-label="Enviar foto de questão"
              className="w-10 h-10 rounded-md text-gray-400 hover:text-white hover:bg-folha-2 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={onVoice}
              title="Gravar áudio"
              aria-label={isListening ? 'Parar gravação' : 'Gravar dúvida por áudio'}
              aria-pressed={isListening}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${
                isListening ? 'bg-red-500/15 text-red-300' : 'text-gray-400 hover:text-white hover:bg-folha-2'
              }`}
            >
              <Mic size={16} className={isListening ? 'animate-pulse' : ''} />
            </button>
            <button
              onClick={onSend}
              disabled={!input.trim()}
              title="Enviar pergunta"
              aria-label="Enviar pergunta"
              id="sendBtn"
              className="w-10 h-10 rounded-md bg-amber-500 hover:bg-amber-400 text-[#1b1406] flex items-center justify-center active:scale-95 transition-colors flex-shrink-0 cursor-pointer disabled:bg-folha-3 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>

          <div className="mt-1.5 pt-2 border-t border-linha flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-medium">Modo:</span>
              <div
                ref={modeContainerRef}
                className="relative flex items-center p-0.5 rounded-md border border-linha-forte"
                role="group"
                aria-label="Modo de resposta"
              >
                {MODOS.map((m) => {
                  const ativo = modoResposta === m.id;
                  const Icone = m.id === 'explicativo' ? BookOpen : MessageSquareText;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      ref={(el) => registrarBotaoModo(m.id, el)}
                      onClick={() => onTrocarModo(m.id)}
                      title={m.desc}
                      aria-pressed={ativo}
                      className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                        ativo ? 'text-white font-semibold' : 'text-gray-400 hover:text-white font-medium'
                      }`}
                    >
                      <Icone size={13} className={ativo ? 'text-amber-400' : ''} aria-hidden="true" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
                <div
                  id="modeIndicatorPill"
                  aria-hidden="true"
                  style={{ left: modePill.left, width: modePill.width || undefined }}
                  className="absolute top-0.5 bottom-0.5 rounded bg-folha-3 mode-slider-pill pointer-events-none"
                />
              </div>
              <span className="hidden sm:inline">
                {modoResposta === 'explicativo' ? 'Passo a passo, com o porquê' : 'Resposta direta, com atalhos'}
              </span>
            </div>
            <span className="hidden md:inline ml-auto">
              <kbd className="font-mono border border-linha-forte px-1.5 py-0.5 rounded text-gray-300">Ctrl + Enter</kbd>
              {' '}envia
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
});
