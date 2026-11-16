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
      className="relative z-20 w-full flex justify-center bg-superficie px-2 md:px-3 pt-2 pb-2 md:pb-3 shrink-0"
      data-purpose="chat-input-container"
    >
      <div
        className={`w-full max-w-4xl rounded-[20px] ${flashKey > 0 ? 'motion-safe:animate-scale-in' : ''}`}
        key={flashKey}
        id="inputWrapperBox"
      >
        <div className="w-full bg-white rounded-[20px] border-2 border-slate-200 shadow-lip p-2.5 transition-colors focus-within:border-ceu-500">
          <div className="flex items-center gap-2 px-1">
            <textarea
              ref={inputRef}
              id="userInput"
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Digite sua dúvida do ENEM"
              rows={1}
              className="w-full !bg-transparent !border-0 resize-none text-tinta-900 placeholder-slate-400 text-base font-semibold focus:ring-0 focus:outline-none py-2 px-1 leading-relaxed max-h-32 !min-h-0 transition-all"
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
              className="w-11 h-11 rounded-2xl bg-azul-100 text-azul-600 hover:bg-azul-200 flex items-center justify-center transition-colors active:scale-95 flex-shrink-0"
            >
              <Camera size={22} strokeWidth={2.5} />
            </button>
            <button
              onClick={onVoice}
              title="Gravar áudio"
              aria-label={isListening ? 'Parar gravação' : 'Gravar dúvida por áudio'}
              aria-pressed={isListening}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors active:scale-95 flex-shrink-0 ${
                isListening
                  ? 'bg-red-100 text-red-600'
                  : 'bg-azul-100 text-azul-600 hover:bg-azul-200'
              }`}
            >
              <Mic size={22} strokeWidth={2.5} className={isListening ? 'animate-pulse' : ''} />
            </button>
            <button
              onClick={onSend}
              disabled={!input.trim()}
              title="Enviar pergunta"
              aria-label="Enviar pergunta"
              id="sendBtn"
              className="w-11 h-11 rounded-2xl bg-azul-600 text-white flex items-center justify-center shadow-lip-azul active:translate-y-1 active:shadow-none transition-transform flex-shrink-0 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Send size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="mt-2 pt-2 border-t-2 border-slate-100 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-extrabold">Modo:</span>
              <div
                ref={modeContainerRef}
                className="relative flex items-center bg-slate-100 p-0.5 rounded-xl"
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
                      className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer font-extrabold ${
                        ativo ? 'text-ceu-600' : 'text-slate-500 hover:text-tinta-900'
                      }`}
                    >
                      <Icone size={13} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
                <div
                  id="modeIndicatorPill"
                  aria-hidden="true"
                  style={{ left: modePill.left, width: modePill.width || undefined }}
                  className="absolute top-0.5 bottom-0.5 rounded-lg bg-white border-2 border-ceu-500 mode-slider-pill pointer-events-none"
                />
              </div>
              <span className="text-[10px] text-slate-600 hidden sm:inline font-medium">
                {modoResposta === 'explicativo' ? '• Passo a passo didático formal' : '• Resposta direta e macetes práticos'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-600 ml-auto">
              <span className="hidden md:inline">
                <kbd className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">Ctrl + Enter</kbd>
                {' '}para enviar
              </span>
              <span className="hidden md:inline font-medium text-slate-500">Midnight Mentor IA © 2025</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});
