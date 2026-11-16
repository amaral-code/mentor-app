import { StyleSheet, Text, type TextProps } from 'react-native';
import { cor } from './tema';
import { useAltoContraste } from './preferenciasAcessibilidade';

type Variante = 'titulo' | 'subtitulo' | 'corpo' | 'legenda' | 'rotulo' | 'numero';

interface Props extends TextProps {
  variante?: Variante;
  cor?: string;
  centro?: boolean;
  negrito?: boolean;
}

/**
 * Texto do app.
 *
 * A fonte acompanha o tamanho escolhido no sistema (fonte dinâmica do
 * iOS, escala do Android). O teto de 2x existe só para a tela não virar
 * uma palavra por linha; abaixo disso, quem precisa de letra grande tem.
 */
export function Texto({ variante = 'corpo', cor: corTexto, centro, negrito, style, ...resto }: Props) {
  // Alto contraste: o texto cinza (corpo, legenda, rótulo) vira tinta.
  const alto = useAltoContraste();
  return (
    <Text
      maxFontSizeMultiplier={2}
      {...resto}
      style={[
        estilos[variante],
        alto && !corTexto ? { color: cor.tinta900 } : null,
        corTexto ? { color: corTexto } : null,
        centro ? estilos.centro : null,
        negrito ? estilos.negrito : null,
        style,
      ]}
    />
  );
}

const estilos = StyleSheet.create({
  titulo: { fontSize: 24, fontWeight: '900', color: cor.tinta900, lineHeight: 30 },
  subtitulo: { fontSize: 18, fontWeight: '800', color: cor.tinta900, lineHeight: 24 },
  corpo: { fontSize: 15, fontWeight: '500', color: cor.tinta700, lineHeight: 22 },
  legenda: { fontSize: 12, fontWeight: '600', color: cor.tinta500, lineHeight: 17 },
  rotulo: {
    fontSize: 12,
    fontWeight: '800',
    color: cor.tinta500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  numero: { fontSize: 28, fontWeight: '900', color: cor.tinta900, fontVariant: ['tabular-nums'] },
  centro: { textAlign: 'center' },
  negrito: { fontWeight: '800' },
});
