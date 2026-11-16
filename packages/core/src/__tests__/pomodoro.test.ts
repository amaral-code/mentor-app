import { describe, expect, it } from 'vitest';
import { estadoDoPomodoro } from '../pomodoro';

const MIN = 60_000;

describe('estadoDoPomodoro', () => {
  it('foco de 25, pausa de 5, e o quarto ciclo ganha pausa longa', () => {
    expect(estadoDoPomodoro(0, 10 * MIN)).toMatchObject({ fase: 'foco', ciclo: 1, restanteSeg: 15 * 60, focoConcluidoMin: 0 });
    expect(estadoDoPomodoro(0, 27 * MIN)).toMatchObject({ fase: 'pausa', ciclo: 1, restanteSeg: 3 * 60, focoConcluidoMin: 25 });
    expect(estadoDoPomodoro(0, 31 * MIN)).toMatchObject({ fase: 'foco', ciclo: 2 });
    // 3 voltas de 30 min = 90; o quarto foco termina aos 115.
    expect(estadoDoPomodoro(0, 116 * MIN)).toMatchObject({ fase: 'pausaLonga', ciclo: 4, focoConcluidoMin: 100 });
  });

  it('volta certo depois de horas com a tela apagada (só depende do início)', () => {
    const e = estadoDoPomodoro(0, 3 * 60 * MIN + 30_000);
    expect(e.fase).toBeDefined();
    expect(e.restanteSeg).toBeGreaterThan(0);
    expect(e.restanteSeg).toBeLessThanOrEqual(e.duracaoSeg);
  });

  it('relógio antes do início não quebra', () => {
    expect(estadoDoPomodoro(10 * MIN, 0)).toMatchObject({ fase: 'foco', ciclo: 1, restanteSeg: 25 * 60 });
  });
});
