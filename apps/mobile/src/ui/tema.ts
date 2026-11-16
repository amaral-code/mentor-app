/**
 * Tokens do visual lúdico, os mesmos do `tailwind.config.js` do web.
 *
 * Ficam aqui, e não num pacote `ui-tokens`, até o design system nativo
 * do M2 (#30) decidir entre NativeWind e StyleSheet. Os nomes seguem o
 * Tailwind (`azul600`, `ceu500`) para a troca ser mecânica.
 */
export const cor = {
  tinta900: '#0B0F19',
  tinta700: '#1E2538',
  tinta500: '#475569',
  cinza400: '#94A3B8',
  cinza300: '#CBD5E1',
  cinza200: '#E2E8F0',
  cinza100: '#F1F5F9',
  branco: '#FFFFFF',
  superficie: '#F4F7FB',

  azul50: '#F3F6FC',
  azul100: '#E6ECF7',
  azul200: '#CCD7EC',
  azul500: '#3A5088',
  azul600: '#2A3B63',
  azul700: '#1E2538',

  ceu50: '#F0F6FF',
  ceu100: '#E3EEFF',
  ceu500: '#4C8DF6',
  ceu600: '#2F6FDB',
  ceu700: '#1E56B8',

  ambar50: '#FFFBEB',
  ambar100: '#FEF3C7',
  ambar500: '#F59E0B',
  ambar600: '#D97706',
  ambar700: '#B45309',

  esmeralda50: '#ECFDF5',
  esmeralda500: '#10B981',
  esmeralda600: '#059669',
  esmeralda700: '#047857',

  vermelho50: '#FEF2F2',
  vermelho500: '#EF4444',
  vermelho600: '#DC2626',

  violeta600: '#7C3AED',
  violeta800: '#5B21B6',
  laranja600: '#EA580C',
} as const;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const raio = { sm: 10, md: 16, lg: 20, xl: 24, pilula: 999 } as const;

/** Lábio do botão/cartão adesivo: borda inferior sólida de 4px. */
export const LABIO = 4;

/** Alvo de toque mínimo (WCAG 2.5.5 e guias da Apple/Google). */
export const ALVO_TOQUE = 48;

export type CorFaixa = 'azul' | 'ceu' | 'ambar' | 'esmeralda' | 'violeta';

/* Tons FORTES de propósito: com o 500, o título branco fica abaixo do
   contraste AA (mesma decisão do CabecalhoPagina do web). */
export const FAIXA: Record<CorFaixa, { fundo: string; labio: string }> = {
  azul: { fundo: cor.azul600, labio: cor.azul700 },
  ceu: { fundo: cor.ceu600, labio: cor.ceu700 },
  ambar: { fundo: cor.ambar600, labio: cor.ambar700 },
  esmeralda: { fundo: cor.esmeralda600, labio: cor.esmeralda700 },
  violeta: { fundo: cor.violeta600, labio: cor.violeta800 },
};

/** Largura a partir da qual o app usa o layout de notebook. */
export const LARGURA_NOTEBOOK = 1024;
