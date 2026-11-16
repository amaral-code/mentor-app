/**
 * Breakpoints do app (Expo, nos três tamanhos da #35): celular (até 819),
 * tablet (820 a 1365) e notebook (1366 ou mais).
 *
 * Fica no core, sem React, para a regra ser testável e igual em toda
 * tela: antes cada tela comparava a largura com um número próprio, e a
 * coluna do conteúdo usava a largura da JANELA sem descontar a barra
 * lateral, o que dava rolagem horizontal entre 1024 e 1180px.
 */
export const BREAKPOINTS = { celular: 390, tablet: 820, notebook: 1366 } as const;

export type Formato = 'celular' | 'tablet' | 'notebook';

export interface Layout {
  formato: Formato;
  /** Abas na lateral em vez de embaixo. */
  barraLateral: boolean;
  /** Largura da barra lateral (0 quando a barra é embaixo). */
  larguraBarra: number;
  /** Rótulo da aba ao lado do ícone (barra larga) ou embaixo (barra estreita). */
  rotuloAoLado: boolean;
  /** Largura útil para o conteúdo, já sem a barra. */
  larguraConteudo: number;
  /** Telas com painel lateral (Central, Quiz, Redação) abrem duas colunas. */
  duasColunas: boolean;
}

/** Teto da coluna de leitura: esticada até 1920px, a linha vira exercício de pescoço. */
export const COLUNA_MAXIMA = 1080;
const BARRA_ESTREITA = 96;
const BARRA_LARGA = 220;

export function formatoDaLargura(largura: number): Formato {
  if (largura >= BREAKPOINTS.notebook) return 'notebook';
  if (largura >= BREAKPOINTS.tablet) return 'tablet';
  return 'celular';
}

export function layoutDaLargura(larguraJanela: number): Layout {
  const largura = Math.max(0, Math.floor(larguraJanela || 0));
  const formato = formatoDaLargura(largura);
  const barraLateral = formato !== 'celular';
  // No tablet, barra estreita (ícone e rótulo embaixo): 220px de 820 é um quarto da tela.
  const rotuloAoLado = largura >= 1024;
  const larguraBarra = !barraLateral ? 0 : rotuloAoLado ? BARRA_LARGA : BARRA_ESTREITA;
  const larguraConteudo = Math.min(largura - larguraBarra, COLUNA_MAXIMA);
  // Duas colunas pedem ao menos 320 de painel + 20 de vão + ~520 de coluna principal.
  const duasColunas = larguraConteudo >= 860;
  return { formato, barraLateral, larguraBarra, rotuloAoLado, larguraConteudo, duasColunas };
}
