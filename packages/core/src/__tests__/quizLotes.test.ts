import { describe, it, expect, vi } from 'vitest';
import {
  QUIZ_TETO_TOKENS_SERVIDOR,
  QUIZ_LOTE_MAX,
  planoDeLotes,
  tokensParaLote,
  objetosJsonCompletos,
  emParalelo,
} from '../quizLotes';

/**
 * Regressao dos dois sintomas relatados no quiz:
 * "demora demais" e "as vezes nao gera dependendo das questoes".
 */

describe('tokensParaLote', () => {
  /*
   * O BUG. `Math.max(4096, count * 500)` estourava o teto de 8192 do
   * back-end a partir de 17 questoes, e a tela permite ate 30. O
   * servidor cortava em silencio e o JSON voltava pela metade.
   */
  it('nunca passa do teto do servidor, em nenhum tamanho de pedido', () => {
    for (let n = 1; n <= 60; n++) {
      expect(tokensParaLote(n), `${n} questoes`).toBeLessThanOrEqual(QUIZ_TETO_TOKENS_SERVIDOR);
    }
  });

  it('a conta antiga ESTOURAVA - prova do bug', () => {
    const contaAntiga = (c: number) => Math.max(4096, c * 500);
    expect(contaAntiga(17)).toBeGreaterThan(QUIZ_TETO_TOKENS_SERVIDOR);
    expect(contaAntiga(30)).toBeGreaterThan(QUIZ_TETO_TOKENS_SERVIDOR);
    // E a nova, no mesmo pedido, cabe.
    expect(tokensParaLote(QUIZ_LOTE_MAX)).toBeLessThanOrEqual(QUIZ_TETO_TOKENS_SERVIDOR);
  });

  it('da mais espaco por questao que a conta antiga', () => {
    // 500/questao era o que truncava a questao dificil, mais longa.
    expect(tokensParaLote(8) / 8).toBeGreaterThan(500);
  });

  it('cresce com o tamanho do lote', () => {
    expect(tokensParaLote(8)).toBeGreaterThan(tokensParaLote(4));
  });
});

describe('planoDeLotes', () => {
  it('pedido pequeno vira um lote unico (sem orquestracao)', () => {
    expect(planoDeLotes(5)).toEqual([5]);
    expect(planoDeLotes(QUIZ_LOTE_MAX)).toEqual([QUIZ_LOTE_MAX]);
  });

  it('sempre soma o total pedido', () => {
    for (let n = 1; n <= 40; n++) {
      expect(planoDeLotes(n).reduce((a, b) => a + b, 0), `${n} questoes`).toBe(n);
    }
  });

  it('nenhum lote passa do teto por lote', () => {
    for (let n = 1; n <= 40; n++) {
      for (const lote of planoDeLotes(n)) expect(lote).toBeLessThanOrEqual(QUIZ_LOTE_MAX);
    }
  });

  /*
   * Equilibrado, nao "cheios + resto": o tempo total e o do lote MAIS
   * LENTO, entao [8,8,7,7] termina antes de [8,8,8,6].
   */
  it('equilibra os lotes em vez de deixar um sobrando pequeno', () => {
    const plano = planoDeLotes(30);
    expect(Math.max(...plano) - Math.min(...plano)).toBeLessThanOrEqual(1);
  });

  it('30 questoes (maximo da tela) viram varios lotes que cabem no teto', () => {
    const plano = planoDeLotes(30);
    expect(plano.length).toBeGreaterThan(1);
    for (const lote of plano) expect(tokensParaLote(lote)).toBeLessThanOrEqual(QUIZ_TETO_TOKENS_SERVIDOR);
  });

  it('total zero ou invalido nao gera lote', () => {
    expect(planoDeLotes(0)).toEqual([]);
    expect(planoDeLotes(-5)).toEqual([]);
    expect(planoDeLotes(NaN)).toEqual([]);
  });
});

describe('objetosJsonCompletos', () => {
  it('extrai objetos de um array completo', () => {
    expect(objetosJsonCompletos('[{"a":1},{"b":2}]')).toHaveLength(2);
  });

  /* O CASO DO BUG: resposta cortada no limite de tokens. */
  it('recupera os objetos inteiros de um array truncado', () => {
    const cortado = '[{"enunciado":"q1","correta":0},{"enunciado":"q2","correta":1},{"enunc';
    const achados = objetosJsonCompletos(cortado);
    expect(achados).toHaveLength(2);
    expect(JSON.parse(achados[1])).toEqual({ enunciado: 'q2', correta: 1 });
  });

  it('nao se perde com chaves DENTRO do texto do enunciado', () => {
    // Um enunciado de matematica com "{1,2}" desalinhava a contagem
    // se as chaves fossem contadas sem respeitar string.
    const t = '[{"enunciado":"o conjunto {1,2} tem"},{"enunciado":"outra"}]';
    expect(objetosJsonCompletos(t)).toHaveLength(2);
  });

  it('nao se perde com aspas escapadas', () => {
    const t = '[{"enunciado":"ele disse \\"oi\\" e saiu"},{"enunciado":"b"}]';
    const achados = objetosJsonCompletos(t);
    expect(achados).toHaveLength(2);
    expect(JSON.parse(achados[0]).enunciado).toBe('ele disse "oi" e saiu');
  });

  it('lida com objeto aninhado', () => {
    expect(objetosJsonCompletos('[{"a":{"b":1}},{"c":2}]')).toHaveLength(2);
  });

  it('texto sem objeto nenhum devolve vazio', () => {
    expect(objetosJsonCompletos('desculpe, nao consigo')).toEqual([]);
    expect(objetosJsonCompletos('')).toEqual([]);
  });
});

describe('emParalelo', () => {
  it('respeita o limite de chamadas simultaneas', async () => {
    let emVoo = 0;
    let pico = 0;
    await emParalelo([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      emVoo++;
      pico = Math.max(pico, emVoo);
      await new Promise((r) => setTimeout(r, 5));
      emVoo--;
      return true;
    });
    expect(pico).toBeLessThanOrEqual(3);
  });

  it('preserva a ordem dos resultados', async () => {
    const r = await emParalelo([1, 2, 3], 2, async (n) => n * 10);
    expect(r.map((x) => x.valor)).toEqual([10, 20, 30]);
  });

  /*
   * O comportamento que remove o "tudo ou nada": um lote ruim nao pode
   * jogar fora os bons.
   */
  it('um item que falha nao derruba os outros', async () => {
    const r = await emParalelo([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('lote ruim');
      return n;
    });
    expect(r[0].valor).toBe(1);
    expect(r[1].erro).toBeInstanceOf(Error);
    expect(r[2].valor).toBe(3);
  });

  it('roda de fato em paralelo, nao em fila', async () => {
    const inicio = Date.now();
    await emParalelo([1, 2, 3], 3, () => new Promise((r) => setTimeout(r, 40)));
    // Em fila seriam ~120ms; em paralelo, ~40ms.
    expect(Date.now() - inicio).toBeLessThan(110);
  });

  it('lista vazia nao trava', async () => {
    const tarefa = vi.fn();
    expect(await emParalelo([], 3, tarefa)).toEqual([]);
    expect(tarefa).not.toHaveBeenCalled();
  });
});
