import { beforeEach, describe, expect, it } from 'vitest';
import { configurarPlataforma, criarArmazenamentoEmMemoria, _resetarPlataforma } from '../plataforma';
import {
  carregarFlashcards,
  flashcardsLocais,
  guardarFlashcards,
  lerFlashcards,
  novoBaralho,
  paraRevisar,
  responderCartao,
} from '../flashcards';

beforeEach(() => {
  _resetarPlataforma();
  configurarPlataforma({ armazenamento: () => mem });
  mem = criarArmazenamentoEmMemoria();
});
let mem = criarArmazenamentoEmMemoria();

describe('lerFlashcards', () => {
  it('aceita o array no meio de texto e descarta cartão incompleto', () => {
    const bruto = 'Claro!\n[{"pergunta":"O que é mitose?","resposta":"Divisão celular."},{"pergunta":"","resposta":"x"},{"resposta":"sem pergunta"}]';
    expect(lerFlashcards(bruto)).toEqual([{ pergunta: 'O que é mitose?', resposta: 'Divisão celular.' }]);
    expect(lerFlashcards('sem json')).toEqual([]);
  });
});

describe('flashcardsLocais', () => {
  it('esconde a palavra mais longa da frase', () => {
    const c = flashcardsLocais([{ id: 'n1', text: 'A fotossíntese transforma luz em energia química nas plantas.' }]);
    expect(c[0].resposta).toBe('fotossíntese');
    expect(c[0].pergunta).toContain('______');
    expect(c[0].notaId).toBe('n1');
  });
});

describe('guardar e carregar', () => {
  it('novos primeiro e sem pergunta repetida', () => {
    guardarFlashcards([{ id: 'a', pergunta: 'P1', resposta: 'R1' }]);
    const todos = guardarFlashcards([{ id: 'b', pergunta: 'p1', resposta: 'outra' }, { id: 'c', pergunta: 'P2', resposta: 'R2' }]);
    expect(todos.map((c) => c.id)).toEqual(['b', 'c']);
    expect(carregarFlashcards()).toHaveLength(2);
  });
});

describe('baralho', () => {
  it('"sabia" tira o cartão; "revisar" manda para o fim até duas vezes', () => {
    let b = novoBaralho(['a', 'b']);
    b = responderCartao(b, false); // a volta
    expect(b.fila).toEqual(['b', 'a']);
    b = responderCartao(b, true); // b sabia
    b = responderCartao(b, false); // a volta 2
    expect(b.fila).toEqual(['a']);
    b = responderCartao(b, false); // a passou do limite: sai
    expect(b.fila).toEqual([]);
    expect(b.sabia).toEqual(['b']);
    expect(paraRevisar(b)).toEqual(['a']);
  });
  it('baralho vazio não quebra', () => {
    expect(responderCartao(novoBaralho([]), true).fila).toEqual([]);
  });
});
