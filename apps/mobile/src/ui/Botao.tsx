import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Texto } from './Texto';
import { ALVO_TOQUE, cor, LABIO, raio } from './tema';
import { useAltoContraste } from './preferenciasAcessibilidade';
import { ANEL_DE_FOCO, type EstadoInteracao } from './acessibilidade';

export type VarianteBotao = 'primario' | 'secundario' | 'ambar' | 'sucesso' | 'ceu' | 'perigo' | 'fantasma';

const VARIANTES: Record<VarianteBotao, { fundo: string; labio: string; texto: string; borda?: string }> = {
  primario: { fundo: cor.azul600, labio: cor.azul700, texto: cor.branco },
  secundario: { fundo: cor.branco, labio: cor.cinza300, texto: cor.azul600, borda: cor.cinza200 },
  ambar: { fundo: cor.ambar500, labio: cor.ambar600, texto: cor.tinta900 },
  /* 700, e não 500: branco sobre esmeralda, céu ou vermelho 500 fica entre
     2,5 e 3,8:1, abaixo do AA (teste em @mentor/ui-tokens). */
  sucesso: { fundo: cor.esmeralda700, labio: '#065F46', texto: cor.branco },
  ceu: { fundo: cor.ceu700, labio: '#1A4594', texto: cor.branco },
  perigo: { fundo: cor.vermelho700, labio: '#991B1B', texto: cor.branco },
  fantasma: { fundo: 'transparent', labio: 'transparent', texto: cor.azul600 },
};

interface Props {
  titulo: string;
  aoTocar: () => void;
  variante?: VarianteBotao;
  icone?: keyof typeof Ionicons.glyphMap;
  desabilitado?: boolean;
  carregando?: boolean;
  /** Texto para o leitor de tela quando o título sozinho não basta. */
  rotuloAcessivel?: string;
  dica?: string;
  compacto?: boolean;
  estilo?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Botão "adesivo": borda de 2px e um lábio sólido de 4px embaixo. Ao
 * pressionar, o lábio some e o botão desce 4px, como no web.
 */
export function Botao({
  titulo,
  aoTocar,
  variante = 'primario',
  icone,
  desabilitado,
  carregando,
  rotuloAcessivel,
  dica,
  compacto,
  estilo,
}: Props) {
  const alto = useAltoContraste();
  const base = VARIANTES[variante];
  // Alto contraste: o botão branco ganha borda escura (a cinza some em tela ao sol).
  const v = alto && variante === 'secundario' ? { ...base, borda: cor.azul600, labio: cor.azul700 } : base;
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      onPress={aoTocar}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? titulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      style={(estado) => {
        const { pressed, hovered, focused } = estado as EstadoInteracao;
        // Mouse por cima: o botão sobe 1px (o lábio cresce), como quem convida o clique.
        const subir = hovered && !pressed && !inativo && variante !== 'fantasma';
        return [
        estilos.base,
        compacto ? estilos.compacto : null,
        {
          backgroundColor: v.fundo,
          borderColor: v.borda ?? v.fundo,
          borderBottomColor: pressed ? v.borda ?? v.fundo : v.labio,
          borderBottomWidth: variante === 'fantasma' ? 0 : pressed ? 2 : 2 + LABIO,
          transform: [{ translateY: pressed && variante !== 'fantasma' ? LABIO : subir ? -1 : 0 }],
          opacity: inativo ? 0.5 : 1,
        },
        variante === 'fantasma' && hovered && !inativo ? { backgroundColor: cor.cinza100 } : null,
        focused ? ANEL_DE_FOCO : null,
        estilo,
      ];
      }}
    >
      <View style={estilos.conteudo}>
        {carregando ? (
          <ActivityIndicator color={v.texto} />
        ) : icone ? (
          <Ionicons name={icone} size={compacto ? 16 : 18} color={v.texto} />
        ) : null}
        <Texto style={[estilos.texto, compacto ? estilos.textoCompacto : null, { color: v.texto }]}>{titulo}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: ALVO_TOQUE + LABIO,
    borderRadius: raio.md,
    borderWidth: 2,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  compacto: { minHeight: 40, paddingHorizontal: 12, borderRadius: raio.sm },
  conteudo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  texto: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'center' },
  textoCompacto: { fontSize: 13 },
});
