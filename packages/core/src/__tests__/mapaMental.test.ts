import { describe, expect, it } from 'vitest';
import { layoutMapaMental, mapaMentalLocal, quebrarRotulo } from '../mapaMental';

describe('quebrarRotulo', () => {
  it('quebra por palavra, no máximo 3 linhas', () => {
    expect(quebrarRotulo('Reação de neutralização entre ácido e base forte')).toEqual(['Reação de', 'neutralização', 'entre ácido e']);
  });
});

describe('layoutMapaMental', () => {
  const dados = {
    titulo: 'Química orgânica',
    ramos: [
      { rotulo: 'Funções', filhos: ['Álcool', 'Cetona', 'Ácido carboxílico'] },
      { rotulo: 'Isomeria', filhos: ['Plana', 'Espacial'] },
      { rotulo: 'Reações', filhos: [] },
    ],
  };

  it('um nó por rótulo e uma aresta por ligação', () => {
    const l = layoutMapaMental(dados);
    expect(l.nos).toHaveLength(1 + 3 + 5);
    expect(l.arestas).toHaveLength(3 + 5);
    expect(l.arestas.filter((a) => a.de === 'c')).toHaveLength(3);
  });

  it('tudo cabe dentro da área, em coordenadas positivas', () => {
    const l = layoutMapaMental(dados);
    for (const n of l.nos) {
      expect(n.x - n.largura / 2).toBeGreaterThanOrEqual(0);
      expect(n.y - n.altura / 2).toBeGreaterThanOrEqual(0);
      expect(n.x + n.largura / 2).toBeLessThanOrEqual(l.largura);
      expect(n.y + n.altura / 2).toBeLessThanOrEqual(l.altura);
    }
  });

  it('ramos não se sobrepõem', () => {
    const ramos = layoutMapaMental({ titulo: 'T', ramos: Array.from({ length: 5 }, (_, i) => ({ rotulo: `Ramo número ${i}`, filhos: [] })) }).nos.filter((n) => n.nivel === 1);
    for (let i = 0; i < ramos.length; i++) {
      for (let j = i + 1; j < ramos.length; j++) {
        const a = ramos[i];
        const b = ramos[j];
        const sobrepoe = Math.abs(a.x - b.x) < (a.largura + b.largura) / 2 && Math.abs(a.y - b.y) < (a.altura + b.altura) / 2;
        expect(sobrepoe).toBe(false);
      }
    }
  });
});

describe('mapaMentalLocal', () => {
  it('palavras frequentes viram ramos, sem palavra vazia', () => {
    const m = mapaMentalLocal(['A mitose divide a célula. Na mitose os cromossomos se separam.', 'A meiose forma gametas. Meiose reduz cromossomos pela metade.']);
    const rotulos = m!.ramos.map((r) => r.rotulo);
    expect(rotulos).toContain('Mitose');
    expect(rotulos).toContain('Meiose');
    expect(rotulos).not.toContain('Pela');
  });
  it('sem conteúdo, sem mapa', () => {
    expect(mapaMentalLocal(['oi'])).toBeNull();
  });
});
