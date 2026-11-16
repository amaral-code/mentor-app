/**
 * Tokens do visual lúdico, os mesmos do `tailwind.config.js` do web.
 *
 * Ficam aqui, e não num pacote `ui-tokens`, até o design system nativo
 * do M2 (#30) decidir entre NativeWind e StyleSheet. Os nomes seguem o
 * Tailwind (`azul600`, `ceu500`) para a troca ser mecânica.
 */
import { alvoToque, branco, espaco as espacoTokens, labio, paletas as p, raio as raioTokens, superficie } from '@mentor/ui-tokens/tokens';

/* Os valores vêm de @mentor/ui-tokens (a mesma fonte do Tailwind do web
   e do NativeWind daqui). Este objeto só dá nomes curtos para o StyleSheet. */
export const cor = {
  tinta900: p.tinta[900],
  tinta700: p.tinta[700],
  tinta500: p.tinta[500],
  cinza400: p.cinza[400],
  cinza300: p.cinza[300],
  cinza200: p.cinza[200],
  cinza100: p.cinza[100],
  branco,
  superficie,

  azul50: p.azul[50],
  azul100: p.azul[100],
  azul200: p.azul[200],
  azul500: p.azul[500],
  azul600: p.azul[600],
  azul700: p.azul[700],

  ceu50: p.ceu[50],
  ceu100: p.ceu[100],
  ceu500: p.ceu[500],
  ceu600: p.ceu[600],
  ceu700: p.ceu[700],

  ambar50: p.ambar[50],
  ambar100: p.ambar[100],
  ambar500: p.ambar[500],
  ambar600: p.ambar[600],
  ambar700: p.ambar[700],

  esmeralda50: p.esmeralda[50],
  esmeralda500: p.esmeralda[500],
  esmeralda600: p.esmeralda[600],
  esmeralda700: p.esmeralda[700],

  vermelho50: p.vermelho[50],
  vermelho500: p.vermelho[500],
  vermelho600: p.vermelho[600],
  vermelho700: p.vermelho[700],

  violeta600: p.violeta[600],
  violeta800: p.violeta[800],
  laranja600: p.laranja[600],
} as const;

export const espaco = espacoTokens;
export const raio = raioTokens;

/** Lábio do botão/cartão adesivo: borda inferior sólida de 4px. */
export const LABIO = labio;

/** Alvo de toque mínimo (WCAG 2.5.5 e guias da Apple/Google). */
export const ALVO_TOQUE = alvoToque;

export type CorFaixa = 'azul' | 'ceu' | 'ambar' | 'esmeralda' | 'violeta';

/* Tons escolhidos pelo teste de contraste do @mentor/ui-tokens: o
   subtítulo da faixa é texto normal (14 px) e precisa de 4,5:1 com o
   branco. Âmbar e esmeralda 600 davam 3,2 e 3,8; foram para o 700. */
export const FAIXA: Record<CorFaixa, { fundo: string; labio: string }> = {
  azul: { fundo: cor.azul600, labio: cor.azul700 },
  ceu: { fundo: cor.ceu600, labio: cor.ceu700 },
  ambar: { fundo: cor.ambar700, labio: '#92400E' },
  esmeralda: { fundo: cor.esmeralda700, labio: '#065F46' },
  violeta: { fundo: cor.violeta600, labio: cor.violeta800 },
};

/** Largura a partir da qual o app usa o layout de notebook. */
export const LARGURA_NOTEBOOK = 1024;
