import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface EventoTecla {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: unknown;
  preventDefault: () => void;
}

/**
 * Ouve o teclado da página (só no web; no celular não há teclado físico
 * na maioria dos casos e o RN não expõe o evento global). Tecla digitada
 * num campo de texto é do campo, não do atalho.
 */
export function useTeclado(aoTeclar: (e: EventoTecla) => boolean | void, ativo = true): void {
  const ref = useRef(aoTeclar);
  ref.current = aoTeclar;
  useEffect(() => {
    if (Platform.OS !== 'web' || !ativo) return;
    const alvo = globalThis as unknown as { addEventListener: (t: string, f: (e: EventoTecla) => void) => void; removeEventListener: (t: string, f: (e: EventoTecla) => void) => void };
    const ouvir = (e: EventoTecla) => {
      const el = e.target as { tagName?: string; isContentEditable?: boolean } | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (ref.current(e) === true) e.preventDefault();
    };
    alvo.addEventListener('keydown', ouvir);
    return () => alvo.removeEventListener('keydown', ouvir);
  }, [ativo]);
}
