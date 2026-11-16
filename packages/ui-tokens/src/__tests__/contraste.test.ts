import { describe, expect, it } from 'vitest';
import { contraste, AA_NORMAL } from '../contraste';
import { paletas as p, branco, superficie } from '../tokens.js';

/*
 * Cada par TEXTO sobre FUNDO que os componentes base usam de verdade.
 * Se alguém mudar um tom e o par cair abaixo de AA, o build quebra aqui,
 * e não na mão de um aluno com baixa visão.
 */
const PARES: [string, string, string][] = [
  ['título no branco', p.tinta[900], branco],
  ['texto no branco', p.tinta[700], branco],
  ['legenda no branco', p.tinta[500], branco],
  ['legenda na superfície', p.tinta[500], superficie],
  ['botão primário', branco, p.azul[600]],
  ['botão âmbar', p.tinta[900], p.ambar[500]],
  ['botão sucesso', branco, p.esmeralda[700]],
  ['botão céu', branco, p.ceu[700]],
  ['botão perigo', branco, p.vermelho[700]],
  ['botão secundário', p.azul[600], branco],
  ['faixa azul', branco, p.azul[600]],
  ['faixa céu', branco, p.ceu[600]],
  ['faixa âmbar', branco, p.ambar[700]],
  ['faixa esmeralda', branco, p.esmeralda[700]],
  ['faixa violeta', branco, p.violeta[600]],
  ['link céu', p.ceu[700], branco],
  ['acerto', p.esmeralda[700], p.esmeralda[50]],
  ['erro', p.vermelho[700], p.vermelho[50]],
  ['aviso âmbar', p.ambar[700], p.ambar[100]],
];

describe('contraste AA dos componentes base', () => {
  it.each(PARES)('%s', (_nome, texto, fundo) => {
    expect(contraste(texto, fundo)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('a conta bate com a referência do WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});
