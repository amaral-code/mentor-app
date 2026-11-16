import { useWindowDimensions } from 'react-native';
import { layoutDaLargura, type Layout } from '@mentor/core/layoutResponsivo';

/** Layout da largura atual da janela (gira o tablet, redimensiona o navegador). */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return layoutDaLargura(width);
}
