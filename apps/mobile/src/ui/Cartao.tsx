import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { cor, LABIO, raio } from './tema';
import { useAltoContraste } from './preferenciasAcessibilidade';
import { ANEL_DE_FOCO, type EstadoInteracao } from './acessibilidade';

interface Props {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  /** Cor de destaque da borda (seleção, acerto, erro). */
  destaque?: string;
  aoTocar?: () => void;
  rotuloAcessivel?: string;
  selecionado?: boolean;
}

/** Cartão adesivo: fundo branco, borda de 2px e lábio de 4px embaixo. */
export function Cartao({ children, estilo, destaque, aoTocar, rotuloAcessivel, selecionado }: Props) {
  const alto = useAltoContraste();
  const borda = destaque ?? (alto ? cor.tinta500 : cor.cinza200);
  const base = [estilos.cartao, { borderColor: borda, borderBottomColor: destaque ?? (alto ? cor.tinta700 : cor.cinza300) }, estilo];
  if (!aoTocar) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      accessibilityState={{ selected: !!selecionado }}
      style={(estado) => {
        const { pressed, hovered, focused } = estado as EstadoInteracao;
        return [
          base,
          hovered && !pressed && !destaque ? { borderColor: cor.ceu500, borderBottomColor: cor.ceu600 } : null,
          pressed ? { transform: [{ translateY: LABIO / 2 }], borderBottomWidth: 2 + LABIO / 2 } : null,
          focused ? ANEL_DE_FOCO : null,
        ];
      }}
    >
      {children}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cor.branco,
    borderRadius: raio.lg,
    borderWidth: 2,
    borderBottomWidth: 2 + LABIO,
    padding: 16,
  },
});

/** Separador vertical padrão entre blocos de uma tela. */
export function Espaco({ altura = 12 }: { altura?: number }) {
  return <View style={{ height: altura }} />;
}
