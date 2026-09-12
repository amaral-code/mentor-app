import { useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { transcreverManuscrito } from '../../../shared/lib/ocrService';

interface Props {
  apiKey: string;
  /** Texto pronto (duvida + trecho) para alimentar o input do chat. */
  onTranscrito: (textoParaChat: string) => void;
  onErro?: (mensagem: string) => void;
}

const MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
/**
 * Escudo Low-Data (edital): teto agressivo no cliente antes de bater na
 * API de visao - foto de caderno de 12MP vira ~200kb, legivel para OCR e
 * barata no 4G noturno.
 */
const ALVO_MB = 0.2;

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * EPICO 1: Ponte analogica-digital. Botao Tailwind que abre camera/galeria;
 * o celular atua so como scanner rapido e a transcricao cai no chat.
 */
export function OcrUploader({ apiKey, onTranscrito, onErro }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file || lendo) return;
    if (!MIMES.includes(file.type)) {
      onErro?.('Formato não aceito. Use JPG ou PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      onErro?.('Foto muito grande. Aproxime só do trecho da dúvida (máx. 5MB).');
      return;
    }
    setLendo(true);
    try {
      // Comprime no cliente (Web Worker, sem travar a UI); se falhar, segue
      // com o original - OCR degradado e melhor que nenhum OCR.
      let foto = file;
      try {
        foto = await imageCompression(file, {
          maxSizeMB: ALVO_MB,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });
      } catch {
        foto = file;
      }
      const dataUrl = await lerComoDataUrl(foto);
      const r = await transcreverManuscrito(dataUrl, { apiKey });
      if (!r.textoParaChat.trim()) {
        onErro?.('Não consegui ler a foto. Tente com mais luz, de cima e sem sombra.');
        return;
      }
      onTranscrito(r.textoParaChat);
    } catch (err) {
      onErro?.(err instanceof Error ? err.message : 'Falha ao digitalizar. Tente de novo.');
    } finally {
      setLendo(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={aoEscolher}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lendo}
        title="Digitalizar caderno (OCR)"
        aria-label={lendo ? 'Digitalizando caderno…' : 'Digitalizar caderno com a câmera'}
        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
      >
        {lendo ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
        ) : (
          <ScanLine size={14} />
        )}
        {lendo ? 'Lendo…' : 'Digitalizar'}
      </button>
    </>
  );
}
