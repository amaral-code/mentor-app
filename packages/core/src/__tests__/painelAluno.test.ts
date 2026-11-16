import { describe, expect, it } from 'vitest';
import { acertoPorMateria, atividadeDaSemana, mediaDeAcerto, progressoDeNivel } from '../painelAluno';

const quiz = (materia: string, acertos: number, total: number) => ({ materia, acertos, total, xpGanho: 0, timestamp: 0 });

describe('acertoPorMateria', () => {
  it('soma os quizzes da mesma matéria e ordena do melhor para o pior', () => {
    const r = acertoPorMateria([quiz('Física', 2, 10), quiz('História', 8, 10), quiz('Física', 4, 10)]);
    expect(r).toEqual([
      { materia: 'História', acertos: 8, total: 10, pct: 80 },
      { materia: 'Física', acertos: 6, total: 20, pct: 30 },
    ]);
  });

  it('ignora quiz sem questões (antes virava NaN%)', () => {
    expect(acertoPorMateria([quiz('Química', 0, 0)])).toEqual([]);
    expect(mediaDeAcerto([])).toBeNull();
  });

  it('média dá peso igual a cada matéria', () => {
    expect(mediaDeAcerto(acertoPorMateria([quiz('A', 10, 10), quiz('B', 0, 30)]))).toBe(50);
  });
});

describe('atividadeDaSemana', () => {
  it('sete dias terminando hoje, no fuso do aparelho', () => {
    const agora = new Date(2026, 10, 16, 23, 30); // segunda, 23h30
    const logs = [
      { timestamp: new Date(2026, 10, 16, 23, 10).getTime() },
      { timestamp: new Date(2026, 10, 16, 8, 0).getTime() },
      { timestamp: new Date(2026, 10, 10, 12, 0).getTime() },
      { timestamp: new Date(2026, 10, 1, 12, 0).getTime() }, // fora da janela
    ];
    const dias = atividadeDaSemana(logs, agora);
    expect(dias).toHaveLength(7);
    expect(dias[6]).toMatchObject({ chave: '2026-11-16', rotulo: 'seg', total: 2, hoje: true });
    expect(dias[0]).toMatchObject({ chave: '2026-11-10', rotulo: 'ter', total: 1, hoje: false });
    expect(dias.reduce((s, d) => s + d.total, 0)).toBe(3);
  });
});

describe('progressoDeNivel', () => {
  it('usa a curva do calcLevel (100, 200, 300...)', () => {
    expect(progressoDeNivel(0)).toEqual({ nivel: 1, xpNoNivel: 0, xpParaProximo: 100, pct: 0 });
    expect(progressoDeNivel(150)).toMatchObject({ nivel: 2, xpNoNivel: 50, xpParaProximo: 200, pct: 25 });
  });

  it('XP negativo ou ausente não quebra a barra', () => {
    expect(progressoDeNivel(-5).nivel).toBe(1);
    expect(progressoDeNivel(Number.NaN).xpNoNivel).toBe(0);
  });
});
