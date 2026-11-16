import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { analisarMarkdown, texParaTexto, type Trecho } from '@mentor/core/textoFormatado';
import { Texto } from '../../ui/Texto';
import { cor } from '../../ui/tema';
import { FormulaKatex } from './FormulaKatex';

function Trechos({ trechos, corTexto }: { trechos: Trecho[]; corTexto: string }) {
  return (
    <>
      {trechos.map((t, i) => {
        switch (t.tipo) {
          case 'negrito':
            return (
              <Texto key={i} style={estilos.negrito} cor={corTexto}>
                {t.texto}
              </Texto>
            );
          case 'italico':
            return (
              <Texto key={i} style={estilos.italico} cor={corTexto}>
                {t.texto}
              </Texto>
            );
          case 'codigo':
            return (
              <Texto key={i} style={estilos.codigo}>
                {t.texto}
              </Texto>
            );
          case 'formula':
            /* Fórmula no meio da frase: texto legível (x², a/b), e não uma
               WebView por fórmula, que não cabe dentro de uma linha. */
            return (
              <Texto key={i} style={estilos.formula} cor={corTexto}>
                {texParaTexto(t.tex)}
              </Texto>
            );
          default:
            return t.texto;
        }
      })}
    </>
  );
}

/**
 * Resposta da IA formatada: parágrafos, títulos, listas, código e
 * fórmulas. Nós de React Native, nunca HTML da IA (mesma regra do web).
 * Memorizado: no streaming o pai renderiza a cada pedaço, e só a última
 * bolha muda.
 */
export const TextoRico = memo(function TextoRico({ texto, corTexto = cor.tinta900 }: { texto: string; corTexto?: string }) {
  const blocos = useMemo(() => analisarMarkdown(texto), [texto]);
  return (
    <View style={{ gap: 6 }}>
      {blocos.map((b, i) => {
        if (b.tipo === 'formula') return <FormulaKatex key={i} tex={b.tex} />;
        if (b.tipo === 'codigo')
          return (
            <View key={i} style={estilos.blocoCodigo}>
              <Texto style={estilos.codigoBloco} selectable>
                {b.texto}
              </Texto>
            </View>
          );
        if (b.tipo === 'item')
          return (
            <View key={i} style={estilos.item}>
              <Texto style={estilos.marcador} cor={corTexto}>
                {b.marcador}
              </Texto>
              <Texto style={{ flex: 1 }} cor={corTexto} selectable>
                <Trechos trechos={b.trechos} corTexto={corTexto} />
              </Texto>
            </View>
          );
        return (
          <Texto key={i} variante={b.tipo === 'titulo' ? 'subtitulo' : 'corpo'} cor={corTexto} selectable accessibilityRole={b.tipo === 'titulo' ? 'header' : undefined}>
            <Trechos trechos={b.trechos} corTexto={corTexto} />
          </Texto>
        );
      })}
    </View>
  );
});

const estilos = StyleSheet.create({
  negrito: { fontWeight: '900' },
  italico: { fontStyle: 'italic' },
  codigo: { fontFamily: 'monospace', backgroundColor: cor.cinza100, fontSize: 14 },
  formula: { fontStyle: 'italic', fontWeight: '700' },
  item: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  marcador: { fontWeight: '900', minWidth: 18 },
  blocoCodigo: { backgroundColor: cor.cinza100, borderRadius: 10, padding: 10 },
  codigoBloco: { fontFamily: 'monospace', fontSize: 13 },
});
