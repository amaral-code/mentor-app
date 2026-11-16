import { describe, expect, it } from 'vitest';
import type { MicroTask } from '../types';
import { centroDaToca, duracaoDaFase, formasDaArvore, montarFloresta, passosDaToca, podeComprovar, proximaFase, rotuloDaArvore, type Fase } from '../florestaDoDia';

const tarefa = (id: string, completed = false): MicroTask => ({ id, titulo: `Tarefa ${id}`, descricao: `Faça ${id}`, icon: 'book', completed });

describe('montarFloresta', () => {
  it('uma árvore por tarefa, o sagui na primeira aberta', () => {
    const f = montarFloresta([tarefa('a', true), tarefa('b'), tarefa('c')]);
    expect(f.arvores.map((a) => a.estado)).toEqual(['feita', 'atual', 'esperando']);
    expect(f.indiceAtual).toBe(1);
    expect(f.feitas).toBe(1);
    expect(f.todasFeitas).toBe(false);
  });

  it('tudo feito: ninguém é atual e a floresta fecha', () => {
    const f = montarFloresta([tarefa('a', true), tarefa('b', true)]);
    expect(f.indiceAtual).toBe(-1);
    expect(f.todasFeitas).toBe(true);
  });

  it('plano vazio não conta como completo', () => {
    expect(montarFloresta([]).todasFeitas).toBe(false);
  });

  it('a mesma tarefa sempre ganha a mesma árvore', () => {
    const a = montarFloresta([tarefa('x'), tarefa('y')]);
    const b = montarFloresta([tarefa('x'), tarefa('y')]);
    expect(a.arvores.map((x) => [x.especie, x.alturaToca])).toEqual(b.arvores.map((x) => [x.especie, x.alturaToca]));
  });

  it('alterna o lado e mantém a toca no meio do tronco', () => {
    const f = montarFloresta(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => tarefa(id)));
    expect(f.arvores.map((a) => a.lado)).toEqual(['esquerda', 'direita', 'esquerda', 'direita', 'esquerda', 'direita']);
    for (const a of f.arvores) {
      expect(a.alturaToca).toBeGreaterThanOrEqual(0.35);
      expect(a.alturaToca).toBeLessThanOrEqual(0.55);
    }
  });
});

describe('proximaFase', () => {
  it('sobe sozinho, entra no toque, sai e volta para a porta', () => {
    let f: Fase = 'subindo';
    f = proximaFase(f, 'fimDaAnimacao');
    expect(f).toBe('pronto');
    f = proximaFase(f, 'tocar');
    expect(f).toBe('entrando');
    f = proximaFase(f, 'fimDaAnimacao');
    expect(f).toBe('dentro');
    f = proximaFase(f, 'fechar');
    expect(f).toBe('saindo');
    f = proximaFase(f, 'fimDaAnimacao');
    expect(f).toBe('pronto');
  });

  it('tocar durante a subida já entra', () => {
    expect(proximaFase('subindo', 'tocar')).toBe('entrando');
  });

  it('dentro da toca, tocar de novo não reinicia nada', () => {
    expect(proximaFase('dentro', 'tocar')).toBe('dentro');
    expect(proximaFase('dentro', 'fimDaAnimacao')).toBe('dentro');
  });

  it('trocar de árvore recomeça a subida, mas não com a toca aberta', () => {
    expect(proximaFase('pronto', 'mudouDeArvore')).toBe('subindo');
    expect(proximaFase('saindo', 'mudouDeArvore')).toBe('subindo');
    expect(proximaFase('dentro', 'mudouDeArvore')).toBe('dentro');
  });

  it('movimento reduzido: nenhuma fase espera', () => {
    for (const f of ['subindo', 'entrando', 'saindo'] as Fase[]) expect(duracaoDaFase(f, true)).toBe(0);
    expect(duracaoDaFase('subindo', false)).toBeGreaterThan(0);
  });
});

describe('passos da toca', () => {
  it('três passos, só a comprovação dá XP', () => {
    const p = passosDaToca(tarefa('a'));
    expect(p.map((x) => x.id)).toEqual(['entender', 'fazer', 'comprovar']);
    expect(p.filter((x) => x.daXp).map((x) => x.id)).toEqual(['comprovar']);
    expect(p[0].texto).toBe('Faça a');
  });

  it('comprovar só abre depois de entender e fazer', () => {
    expect(podeComprovar(new Set())).toBe(false);
    expect(podeComprovar(new Set(['entender']))).toBe(false);
    expect(podeComprovar(new Set(['entender', 'fazer']))).toBe(true);
  });

  it('rótulo diz a posição, o estado e a ação', () => {
    const f = montarFloresta([tarefa('a', true), tarefa('b')]);
    expect(rotuloDaArvore(f.arvores[0], 2)).toBe('Árvore 1 de 2: Tarefa a. Concluída.');
    expect(rotuloDaArvore(f.arvores[1], 2)).toContain('O sagui está aqui');
    // Tocar na árvore nunca entra na missão: o rótulo não promete isso.
    expect(rotuloDaArvore(f.arvores[1], 2)).not.toMatch(/Entrar|Iniciar/);
    expect(rotuloDaArvore(f.arvores[1], 2, false)).toContain('Levar o sagui até esta árvore');
  });
});

describe('formasDaArvore', () => {
  it('a toca fica no tronco, entre o pé e o topo', () => {
    for (const h of [0.35, 0.45, 0.55]) {
      const t = centroDaToca(h);
      expect(t.x).toBe(80);
      expect(t.y).toBeGreaterThan(92);
      expect(t.y).toBeLessThan(218);
    }
  });

  it('só a árvore feita tem fruta', () => {
    const frutas = (estado: 'feita' | 'atual' | 'esperando') =>
      formasDaArvore({ especie: 'redonda', estado, alturaToca: 0.4 }).filter((f) => f.cor === '#F59E0B').length;
    expect(frutas('feita')).toBe(4);
    expect(frutas('atual')).toBe(0);
    expect(frutas('esperando')).toBe(0);
  });

  it('só a árvore da vez tem estrelinhas', () => {
    const estrelas = (estado: 'feita' | 'atual' | 'esperando') =>
      formasDaArvore({ especie: 'nuvem', estado, alturaToca: 0.4 }).filter((f) => f.cor === '#FCD34D').length;
    expect(estrelas('atual')).toBe(3);
    expect(estrelas('feita') + estrelas('esperando')).toBe(0);
  });

  it('todo desenho cabe no quadro', () => {
    for (const especie of ['redonda', 'pinheiro', 'nuvem'] as const) {
      for (const f of formasDaArvore({ especie, estado: 'feita', alturaToca: 0.55 })) {
        if (f.forma === 'circulo') expect(f.cx - f.r).toBeGreaterThanOrEqual(0);
        if (f.forma === 'elipse') {
          expect(f.cx - f.rx).toBeGreaterThanOrEqual(0);
          expect(f.cx + f.rx).toBeLessThanOrEqual(160);
          expect(f.cy + f.ry).toBeLessThanOrEqual(230);
        }
      }
    }
  });

  it('a toca é a última forma (fica por cima de tudo)', () => {
    const formas = formasDaArvore({ especie: 'pinheiro', estado: 'atual', alturaToca: 0.5 });
    expect(formas[formas.length - 1]).toMatchObject({ forma: 'elipse', cx: 80, cy: centroDaToca(0.5).y + 2 });
  });
});
