import { createElement, useEffect, useMemo } from 'react';
import katex from 'katex';
import { texParaTexto } from '@mentor/core/textoFormatado';
import { Texto } from '../../ui/Texto';
import { CSS_KATEX } from './katexCss';

let estiloInstalado = false;

/**
 * No navegador não precisa de WebView: o HTML do KaTeX entra direto. É
 * HTML gerado pelo KaTeX (que escapa o texto e, com `trust: false`, não
 * aceita \href), nunca o texto da IA cru.
 */
export function FormulaKatex({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: true, trust: false, output: 'html' });
    } catch {
      return null;
    }
  }, [tex]);

  useEffect(() => {
    if (estiloInstalado || typeof document === 'undefined') return;
    estiloInstalado = true;
    const estilo = document.createElement('style');
    estilo.textContent = CSS_KATEX;
    document.head.appendChild(estilo);
  }, []);

  if (!html) return <Texto style={{ fontStyle: 'italic', textAlign: 'center' }}>{texParaTexto(tex)}</Texto>;
  return createElement('div', {
    role: 'img',
    'aria-label': `Fórmula: ${texParaTexto(tex)}`,
    style: { overflowX: 'auto', margin: '4px 0' },
    dangerouslySetInnerHTML: { __html: html },
  });
}
