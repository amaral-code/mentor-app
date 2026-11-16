import { describe, expect, it } from 'vitest';
import { bytesDoBase64, dimensoesParaEnvio, recorteDaGuia, PROPORCAO_A4 } from '../imagem';

describe('dimensoesParaEnvio', () => {
  it('reduz o lado maior para 1600 mantendo a proporção', () => {
    expect(dimensoesParaEnvio(3024, 4032)).toEqual({ largura: 1200, altura: 1600 });
    expect(dimensoesParaEnvio(4032, 3024)).toEqual({ largura: 1600, altura: 1200 });
  });
  it('foto pequena não é ampliada', () => {
    expect(dimensoesParaEnvio(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe('recorteDaGuia', () => {
  it('foto em pé: corta faixas de cima e de baixo na proporção A4', () => {
    const r = recorteDaGuia(3000, 5000, PROPORCAO_A4, 0);
    expect(r.width).toBe(3000);
    expect(r.height).toBe(Math.round(3000 / PROPORCAO_A4));
    expect(r.originX).toBe(0);
    expect(r.originY).toBe(Math.round((5000 - r.height) / 2));
  });
  it('foto deitada: a folha fica no centro, pela altura', () => {
    const r = recorteDaGuia(4000, 3000, PROPORCAO_A4, 0);
    expect(r.height).toBe(3000);
    expect(r.originX).toBeGreaterThan(0);
    expect(r.originX + r.width).toBeLessThanOrEqual(4000);
  });
  it('a folga nunca sai da foto', () => {
    const r = recorteDaGuia(1000, 1414, PROPORCAO_A4, 0.5);
    expect(r.originX).toBeGreaterThanOrEqual(0);
    expect(r.originY).toBeGreaterThanOrEqual(0);
    expect(r.width).toBeLessThanOrEqual(1000);
    expect(r.height).toBeLessThanOrEqual(1414);
  });
});

describe('bytesDoBase64', () => {
  it('conta com e sem prefixo de data URI', () => {
    expect(bytesDoBase64('QUJD')).toBe(3);
    expect(bytesDoBase64('data:image/jpeg;base64,QUI=')).toBe(2);
  });
});
