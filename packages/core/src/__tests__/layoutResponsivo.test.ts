import { describe, expect, it } from 'vitest';
import { formatoDaLargura, layoutDaLargura, COLUNA_MAXIMA } from '../layoutResponsivo';

describe('layoutResponsivo', () => {
  it('classifica os três tamanhos da equipe', () => {
    expect(formatoDaLargura(390)).toBe('celular');
    expect(formatoDaLargura(819)).toBe('celular');
    expect(formatoDaLargura(820)).toBe('tablet');
    expect(formatoDaLargura(1365)).toBe('tablet');
    expect(formatoDaLargura(1366)).toBe('notebook');
  });

  it('celular: barra embaixo e uma coluna', () => {
    const l = layoutDaLargura(390);
    expect(l.barraLateral).toBe(false);
    expect(l.larguraBarra).toBe(0);
    expect(l.duasColunas).toBe(false);
    expect(l.larguraConteudo).toBe(390);
  });

  it('tablet em pé: barra lateral estreita, sem duas colunas', () => {
    const l = layoutDaLargura(820);
    expect(l.barraLateral).toBe(true);
    expect(l.rotuloAoLado).toBe(false);
    expect(l.duasColunas).toBe(false);
  });

  it('o conteúdo nunca passa da janela menos a barra (sem rolagem horizontal)', () => {
    for (let w = 300; w <= 2560; w += 7) {
      const l = layoutDaLargura(w);
      expect(l.larguraConteudo + l.larguraBarra).toBeLessThanOrEqual(w);
      expect(l.larguraConteudo).toBeLessThanOrEqual(COLUNA_MAXIMA);
    }
  });

  it('notebook: barra larga e duas colunas', () => {
    const l = layoutDaLargura(1366);
    expect(l.rotuloAoLado).toBe(true);
    expect(l.duasColunas).toBe(true);
  });

  it('largura inválida não quebra', () => {
    expect(layoutDaLargura(Number.NaN).formato).toBe('celular');
  });
});
