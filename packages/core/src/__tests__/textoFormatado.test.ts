import { describe, expect, it } from 'vitest';
import { analisarMarkdown, analisarTrechos, texParaTexto } from '../textoFormatado';

describe('analisarTrechos', () => {
  it('negrito, itálico, código e fórmula na mesma linha', () => {
    expect(analisarTrechos('O **coeficiente** é *a* em `y = ax + b`, ou $a = 2$.')).toEqual([
      { tipo: 'texto', texto: 'O ' },
      { tipo: 'negrito', texto: 'coeficiente' },
      { tipo: 'texto', texto: ' é ' },
      { tipo: 'italico', texto: 'a' },
      { tipo: 'texto', texto: ' em ' },
      { tipo: 'codigo', texto: 'y = ax + b' },
      { tipo: 'texto', texto: ', ou ' },
      { tipo: 'formula', tex: 'a = 2' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('asterisco dentro de fórmula não vira itálico', () => {
    expect(analisarTrechos('$a*b*c$')).toEqual([{ tipo: 'formula', tex: 'a*b*c' }]);
  });

  it('marcação cortada no meio (streaming) continua texto', () => {
    expect(analisarTrechos('isso é **impor')).toEqual([{ tipo: 'texto', texto: 'isso é **impor' }]);
  });
});

describe('analisarMarkdown', () => {
  it('títulos, listas, fórmula em bloco e parágrafos', () => {
    const blocos = analisarMarkdown('## Passo a passo\n\n1. Pegue dois pontos\n- Calcule\n\n$$a = \\frac{1}{2}$$\nFim.');
    expect(blocos.map((b) => b.tipo)).toEqual(['titulo', 'item', 'item', 'formula', 'paragrafo']);
    expect(blocos[1]).toMatchObject({ marcador: '1.' });
    expect(blocos[2]).toMatchObject({ marcador: '•' });
    expect(blocos[3]).toEqual({ tipo: 'formula', tex: 'a = \\frac{1}{2}' });
  });

  it('fórmula em bloco de várias linhas e bloco de código', () => {
    const blocos = analisarMarkdown('\\[\nx^2 + 1\n\\]\n```\nprint(1)\n```');
    expect(blocos).toEqual([
      { tipo: 'formula', tex: 'x^2 + 1' },
      { tipo: 'codigo', texto: 'print(1)' },
    ]);
  });

  it('$$ aberto sem fechamento (pedaço do streaming) não some', () => {
    const blocos = analisarMarkdown('Veja:\n$$a = \\frac{1');
    expect(blocos).toHaveLength(1);
    expect(blocos[0].tipo).toBe('paragrafo');
  });
});

describe('texParaTexto', () => {
  it('fração, índice e potência', () => {
    expect(texParaTexto('a = \\frac{y_2 - y_1}{x_2 - x_1}')).toBe('a = (y₂ − y₁)/(x₂ − x₁)');
    expect(texParaTexto('x^2 + 2x + 1')).toBe('x² + 2x + 1');
    expect(texParaTexto('\\frac{1}{2}')).toBe('1/2');
  });

  it('raiz, símbolos e texto', () => {
    expect(texParaTexto('\\sqrt{b^2 - 4ac}')).toBe('√(b² − 4ac)');
    expect(texParaTexto('\\Delta t \\geq 0 \\text{ s}')).toBe('Δt ≥ 0 s');
    expect(texParaTexto('\\left( 3 \\cdot \\pi \\right)')).toBe('(3 · π)');
  });

  it('expoente sem sobrescrito vira ^(...)', () => {
    expect(texParaTexto('e^{kt}')).toBe('e^(kt)');
  });
});
