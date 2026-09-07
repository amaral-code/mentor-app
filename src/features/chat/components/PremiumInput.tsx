import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
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
 */
export function PremiumInput({
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
      className="relative z-20 w-full flex justify-center bg-gradient-to-t from-[#060913] via-[#060913]/90 to-transparent pt-3 pb-1 shrink-0"
      data-purpose="chat-input-container"
    >
      <div
        className={`w-full max-w-4xl p-[1.5px] rounded-2xl cyber-input-wrap shadow-[0_10px_45px_rgba(0,0,0,0.7)] ${flashKey > 0 ? 'input-flash' : ''}`}
        key={flashKey}
        id="inputWrapperBox"
      >
        <div className="w-full bg-[#0b101c]/95 backdrop-blur-2xl rounded-[15px] p-3 transition-all focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:shadow-[0_0_25px_rgba(245,158,11,0.25)]">
          <div className="flex items-center gap-2 px-1">
            <textarea
              ref={inputRef}
              id="userInput"
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Digite sua dúvida do ENEM, cole um enunciado ou peça um macete..."
              rows={1}
              className="w-full bg-transparent border-0 resize-none text-slate-100 placeholder-slate-400 text-sm focus:ring-0 focus:outline-none py-2 px-1 leading-relaxed max-h-32 font-sans transition-all"
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
              className="w-8 h-8 rounded-xl text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-400/30 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0 shadow-sm"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={onVoice}
              title="Gravar áudio"
              aria-label={isListening ? 'Parar gravação' : 'Gravar dúvida por áudio'}
              aria-pressed={isListening}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0 shadow-sm ${
                isListening
                  ? 'bg-red-500/15 text-red-400 border-red-400/30'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-amber-500/10 border-transparent hover:border-amber-400/30'
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
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-midnight-950 font-black flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.65)] hover:shadow-[0_0_28px_rgba(245,158,11,0.9)] hover:scale-110 active:scale-95 transition-all flex-shrink-0 cursor-pointer disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400 font-sans">
            <div className="flex items-center gap-2">
              <span className="font-medium">Modo:</span>
              <div
                ref={modeContainerRef}
                className="relative flex items-center bg-[#070b14] p-0.5 rounded-xl border border-white/10 shadow-inner"
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
                      className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] transition-all cursor-pointer ${
                        ativo ? 'text-amber-200 font-bold' : 'text-slate-400 hover:text-white font-medium'
                      }`}
                    >
                      <Icone size={10} className={ativo ? 'text-amber-400' : ''} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
                <div
                  id="modeIndicatorPill"
                  aria-hidden="true"
                  style={{ left: modePill.left, width: modePill.width || undefined }}
                  className="absolute top-0.5 bottom-0.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.3)] mode-slider-pill pointer-events-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline font-medium">
                {modoResposta === 'explicativo' ? '• Passo a passo didático formal' : '• Resposta direta e macetes práticos'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 ml-auto">
              <span className="hidden md:inline">
                <kbd className="font-mono bg-slate-800/90 border border-white/10 px-1.5 py-0.5 rounded text-slate-300 font-semibold">Ctrl + Enter</kbd>
                {' '}para enviar
              </span>
              <span className="hidden md:inline font-medium text-slate-500">Midnight Mentor IA © 2025</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
