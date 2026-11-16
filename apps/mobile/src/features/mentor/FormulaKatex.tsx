import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import katex from 'katex';
import { texParaTexto } from '@mentor/core/textoFormatado';
import { Texto } from '../../ui/Texto';
import { cor } from '../../ui/tema';
import { CSS_KATEX } from './katexCss';

/**
 * Fórmula em bloco desenhada pelo KaTeX dentro de uma WebView.
 *
 * O HTML é gerado aqui, pelo `katex.renderToString` (JavaScript puro,
 * roda no Hermes); a WebView só pinta. Ela não recebe texto da IA como
 * HTML: o KaTeX escapa tudo que não é fórmula, e `trust: false` barra
 * \href e \url. A altura vem da própria página, por postMessage.
 *
 * Sem rede, a folha de estilo do KaTeX não chega e a fórmula sai com a
 * fonte do sistema: feia, mas legível. Erro de TeX cai no texto legível.
 */
export function FormulaKatex({ tex }: { tex: string }) {
  const [altura, setAltura] = useState(48);
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: true, trust: false, output: 'html' });
    } catch {
      return null;
    }
  }, [tex]);

  if (!html) {
    return (
      <Texto style={{ fontStyle: 'italic', textAlign: 'center', marginVertical: 6 }} accessibilityLabel={`Fórmula: ${texParaTexto(tex)}`}>
        {texParaTexto(tex)}
      </Texto>
    );
  }

  const pagina = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${CSS_KATEX}</style></head>
<body style="margin:0;padding:4px 0;background:transparent;color:${cor.tinta900};overflow-x:auto">${html}
<script>
  function medir(){ window.ReactNativeWebView.postMessage(String(document.body.scrollHeight)); }
  window.addEventListener('load', medir); setTimeout(medir, 300);
</script></body></html>`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Fórmula: ${texParaTexto(tex)}`} style={{ height: altura, marginVertical: 4 }}>
      <WebView
        originWhitelist={['about:blank']}
        source={{ html: pagina }}
        scrollEnabled={false}
        javaScriptEnabled
        onMessage={(e) => setAltura(Math.max(32, Math.min(400, Number(e.nativeEvent.data) || 48)))}
        style={{ backgroundColor: 'transparent' }}
        // Link dentro da fórmula nunca abre nada: trust:false já barra, isto é a segunda tranca.
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('https://cdn.jsdelivr.net/')}
      />
    </View>
  );
}
