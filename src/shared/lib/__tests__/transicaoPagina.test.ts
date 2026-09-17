import { describe, expect, it } from 'vitest';
import { pageEnter, pageEnterSuave } from '../motionPresets';

/**
 * Transicao de troca de aba, nas duas variantes.
 *
 * ------------------------------------------------------------------
 * O BUG QUE ISTO IMPEDE DE VOLTAR
 * ------------------------------------------------------------------
 * Com "reduzir movimento" ligado (no sistema ou na chave do app), a
 * troca de aba nao animava NADA: as quatro props do motion viravam
 * `undefined` e o conteudo era substituido de uma vez. Quem ativou a
 * preferencia ficava sem nenhuma pista visual de que a secao mudou.
 *
 * Isso e mais do que a preferencia pede. O que incomoda e DESLOCAMENTO -
 * deslize, parallax, escala. Opacidade nao desloca nada, e a
 * recomendacao corrente e trocar o deslize por um crossfade, nao remover
 * a transicao.
 */

/** Le o valor de um eixo dentro de uma variante, ignorando `transition`. */
const eixo = (v: unknown, chave: string) =>
  v && typeof v === 'object' ? (v as Record<string, unknown>)[chave] : undefined;

describe('pageEnter (movimento normal)', () => {
  it('faz fade de 0 a 1', () => {
    expect(eixo(pageEnter.inicial, 'opacity')).toBe(0);
    expect(eixo(pageEnter.animar, 'opacity')).toBe(1);
    expect(eixo(pageEnter.sair, 'opacity')).toBe(0);
  });

  it('desliza no eixo vertical', () => {
    expect(eixo(pageEnter.inicial, 'y')).not.toBe(0);
  });

  /*
   * Com `mode="wait"` as duracoes SOMAM: a pagina que sai termina antes
   * de a nova comecar. Era 0.15 + 0.3 = 0.45s por troca, e navegacao com
   * quase meio segundo de espera passa sensacao de app travado.
   */
  it('soma das duracoes fica em 0.3s', () => {
    const entrada = (eixo(pageEnter.animar, 'transition') as { duration: number }).duration;
    const saida = (eixo(pageEnter.sair, 'transition') as { duration: number }).duration;
    expect(entrada + saida).toBeCloseTo(0.3, 2);
    expect(entrada + saida).toBeLessThan(0.45);
  });
});

describe('pageEnterSuave (movimento reduzido)', () => {
  it('AINDA faz fade - nao e ausencia de transicao', () => {
    expect(eixo(pageEnterSuave.inicial, 'opacity')).toBe(0);
    expect(eixo(pageEnterSuave.animar, 'opacity')).toBe(1);
    expect(eixo(pageEnterSuave.sair, 'opacity')).toBe(0);
  });

  /* O ponto da variante: opacidade sim, deslocamento nao. */
  it('nao desloca, escala nem rotaciona nada', () => {
    for (const [nome, variante] of Object.entries(pageEnterSuave)) {
      for (const proibido of ['x', 'y', 'scale', 'rotate', 'translateX', 'translateY']) {
        expect(eixo(variante, proibido), `${nome}.${proibido}`).toBeUndefined();
      }
    }
  });

  it('e mais curta que a versao normal', () => {
    const dur = (v: unknown) => (eixo(v, 'transition') as { duration: number }).duration;
    expect(dur(pageEnterSuave.animar)).toBeLessThan(dur(pageEnter.animar));
    expect(dur(pageEnterSuave.sair)).toBeLessThan(dur(pageEnter.sair));
  });

  it('tem os mesmos estados da versao normal', () => {
    // Se uma ganhar um estado e a outra nao, o AppShell quebra ao trocar.
    expect(Object.keys(pageEnterSuave).sort()).toEqual(Object.keys(pageEnter).sort());
  });
});
