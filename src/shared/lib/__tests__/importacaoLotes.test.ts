import { describe, expect, it } from 'vitest';
import { dividirEmLotes, juntarRelatorios } from '../importacaoLotes';

describe('importação em lotes', () => {
  it('divide sem perder nem repetir ninguém', () => {
    const turma = Array.from({ length: 19 }, (_, i) => i);
    const lotes = dividirEmLotes(turma, 8);
    expect(lotes.map((l) => l.length)).toEqual([8, 8, 3]);
    expect(lotes.flat()).toEqual(turma);
    expect(dividirEmLotes([], 8)).toEqual([]);
  });

  it('soma os relatórios e numera as linhas pela planilha inteira', () => {
    const junto = juntarRelatorios(
      [
        { escola: 'Sol', criados: 8, emailsEnviados: 8, normalizadoPorIA: false, resultados: [{ linha: 1 }, { linha: 8 }] },
        { escola: 'Sol', criados: 2, emailsEnviados: 1, normalizadoPorIA: true, resultados: [{ linha: 3 }] },
      ],
      8,
    );
    expect(junto?.criados).toBe(10);
    expect(junto?.emailsEnviados).toBe(9);
    expect(junto?.normalizadoPorIA).toBe(true);
    expect(junto?.resultados?.map((r) => r.linha)).toEqual([1, 8, 11]);
  });

  it('sem lote nenhum não inventa relatório', () => {
    expect(juntarRelatorios([])).toBeNull();
  });
});
