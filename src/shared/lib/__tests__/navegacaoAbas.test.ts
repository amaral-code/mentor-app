import { describe, expect, it } from 'vitest';
import { ehTeclaNavegacao, proximoIndiceFoco, TECLAS_NAVEGACAO } from '../navegacaoAbas';

/** A sidebar tem 15 abas; os casos usam esse tamanho real. */
const TOTAL = 15;

describe('proximoIndiceFoco', () => {
  it('seta para baixo anda um item', () => {
    expect(proximoIndiceFoco('ArrowDown', 0, TOTAL)).toBe(1);
    expect(proximoIndiceFoco('ArrowDown', 7, TOTAL)).toBe(8);
  });

  it('seta para cima volta um item', () => {
    expect(proximoIndiceFoco('ArrowUp', 5, TOTAL)).toBe(4);
  });

  /*
   * Circular nos dois sentidos: numa lista de 15, parar na ponta
   * obrigaria a percorrer tudo de volta para chegar ao outro extremo.
   */
  it('do ultimo para baixo volta ao primeiro', () => {
    expect(proximoIndiceFoco('ArrowDown', TOTAL - 1, TOTAL)).toBe(0);
  });

  it('do primeiro para cima vai ao ultimo', () => {
    expect(proximoIndiceFoco('ArrowUp', 0, TOTAL)).toBe(TOTAL - 1);
  });

  it('Home e End vao aos extremos', () => {
    expect(proximoIndiceFoco('Home', 9, TOTAL)).toBe(0);
    expect(proximoIndiceFoco('End', 2, TOTAL)).toBe(TOTAL - 1);
  });

  it('Home no primeiro e End no ultimo nao saem do lugar', () => {
    expect(proximoIndiceFoco('Home', 0, TOTAL)).toBe(0);
    expect(proximoIndiceFoco('End', TOTAL - 1, TOTAL)).toBe(TOTAL - 1);
  });

  /*
   * `null` faz o componente NAO chamar preventDefault. Engolir teclas que
   * nao sao nossas quebraria atalhos do navegador e do leitor de tela.
   */
  it('tecla que nao e de navegacao devolve null', () => {
    for (const tecla of ['Enter', ' ', 'Tab', 'a', 'Escape', 'ArrowLeft', 'ArrowRight']) {
      expect(proximoIndiceFoco(tecla, 3, TOTAL), tecla).toBeNull();
    }
  });

  it('foco fora da lista devolve null', () => {
    // -1 e o que `indexOf` devolve quando o foco esta em outro elemento.
    expect(proximoIndiceFoco('ArrowDown', -1, TOTAL)).toBeNull();
    expect(proximoIndiceFoco('ArrowDown', TOTAL, TOTAL)).toBeNull();
  });

  it('lista vazia nao quebra', () => {
    expect(proximoIndiceFoco('ArrowDown', 0, 0)).toBeNull();
    expect(proximoIndiceFoco('Home', 0, 0)).toBeNull();
  });

  it('lista de um item unico sempre aponta para ele mesmo', () => {
    for (const tecla of TECLAS_NAVEGACAO) {
      expect(proximoIndiceFoco(tecla, 0, 1), tecla).toBe(0);
    }
  });

  it('nunca devolve indice fora da lista, em nenhuma combinacao', () => {
    for (const tecla of TECLAS_NAVEGACAO) {
      for (let i = 0; i < TOTAL; i++) {
        const d = proximoIndiceFoco(tecla, i, TOTAL);
        expect(d).not.toBeNull();
        expect(d! >= 0 && d! < TOTAL, `${tecla} em ${i} devolveu ${d}`).toBe(true);
      }
    }
  });
});

describe('ehTeclaNavegacao', () => {
  it('reconhece so as quatro teclas', () => {
    expect(TECLAS_NAVEGACAO).toHaveLength(4);
    for (const t of TECLAS_NAVEGACAO) expect(ehTeclaNavegacao(t)).toBe(true);
    expect(ehTeclaNavegacao('Enter')).toBe(false);
  });
});
