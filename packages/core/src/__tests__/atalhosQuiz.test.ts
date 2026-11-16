import { describe, expect, it } from 'vitest';
import { acaoDaTecla } from '../atalhosQuiz';

const aberta = { respondida: false, alternativas: 5 };
const respondida = { respondida: true, alternativas: 5 };

describe('acaoDaTecla', () => {
  it('número e letra respondem', () => {
    expect(acaoDaTecla('1', aberta)).toEqual({ tipo: 'responder', indice: 0 });
    expect(acaoDaTecla('c', aberta)).toEqual({ tipo: 'responder', indice: 2 });
    expect(acaoDaTecla('E', aberta)).toEqual({ tipo: 'responder', indice: 4 });
  });
  it('fora das alternativas não faz nada', () => {
    expect(acaoDaTecla('6', aberta)).toBeNull();
    expect(acaoDaTecla('d', { respondida: false, alternativas: 3 })).toBeNull();
  });
  it('Enter antes de responder não marca nada', () => {
    expect(acaoDaTecla('Enter', aberta)).toBeNull();
  });
  it('depois de responder, Enter, espaço e seta avançam; letra não troca a resposta', () => {
    expect(acaoDaTecla('Enter', respondida)).toEqual({ tipo: 'proxima' });
    expect(acaoDaTecla(' ', respondida)).toEqual({ tipo: 'proxima' });
    expect(acaoDaTecla('ArrowRight', respondida)).toEqual({ tipo: 'proxima' });
    expect(acaoDaTecla('a', respondida)).toBeNull();
  });
  it('com Ctrl, Cmd ou Alt a tecla é do navegador', () => {
    expect(acaoDaTecla('1', aberta, { ctrl: true })).toBeNull();
    expect(acaoDaTecla('Enter', respondida, { meta: true })).toBeNull();
  });
});
