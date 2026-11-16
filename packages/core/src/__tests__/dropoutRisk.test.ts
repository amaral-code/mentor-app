import { describe, it, expect } from 'vitest';
import { calculateDropoutRisk, linearRegression, addMonths, PROJECTION_MONTHS, StudentMonthlyRecord } from '../dropoutRisk';

describe('linearRegression', () => {
  it('perfeita reta crescente y = 2x + 2', () => {
    const fit = linearRegression([
      { x: 0, y: 2 }, { x: 1, y: 4 }, { x: 2, y: 6 },
    ]);
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(2);
    expect(fit.r2).toBeCloseTo(1);
  });

  it('retorna ajuste nulo quando não há dados', () => {
    const fit = linearRegression([]);
    expect(fit).toEqual({ slope: 0, intercept: 0, r2: 0 });
  });

  it('não divide por zero com um único ponto', () => {
    const fit = linearRegression([{ x: 3, y: 80 }]);
    expect(fit.slope).toBe(0);
    expect(fit.intercept).toBe(80);
    expect(fit.r2).toBe(1);
  });
});

describe('addMonths', () => {
  it('avança mês e vira o ano', () => {
    expect(addMonths('2025-11', 2)).toBe('2026-01');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-02', 4)).toBe('2026-06');
  });
});

describe('calculateDropoutRisk', () => {
  it('projeta exatamente 4 meses consecutivos', () => {
    const data: StudentMonthlyRecord[] = [
      { month: '2025-09', notaMedia: 70, tempoUso: 8 },
      { month: '2025-10', notaMedia: 68, tempoUso: 7 },
      { month: '2025-11', notaMedia: 65, tempoUso: 6 },
    ];
    const result = calculateDropoutRisk(data);
    expect(result.projection).toHaveLength(PROJECTION_MONTHS);
    expect(result.projection[0].month).toBe('2025-12');
    expect(result.projection[1].month).toBe('2026-01');
    expect(result.projection[3].month).toBe('2026-03');
  });

  it('aponta queda e risco alto quando a tendência é descendente', () => {
    const data: StudentMonthlyRecord[] = [
      { month: '2025-09', notaMedia: 80, tempoUso: 10 },
      { month: '2025-10', notaMedia: 74, tempoUso: 8 },
      { month: '2025-11', notaMedia: 68, tempoUso: 6 },
      { month: '2025-12', notaMedia: 62, tempoUso: 4 },
      { month: '2026-01', notaMedia: 56, tempoUso: 2 },
      { month: '2026-02', notaMedia: 50, tempoUso: 1 },
    ];
    const result = calculateDropoutRisk(data);
    expect(result.trend).toBe('falling');
    expect(result.slope).toBeLessThan(0);
    expect(result.riskLevel).toBe('red');
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.projectedAverage).toBeLessThan(result.currentAverage);
  });

  it('aponta alta e excelência quando a tendência é ascendente', () => {
    const data: StudentMonthlyRecord[] = [
      { month: '2025-09', notaMedia: 50, tempoUso: 4 },
      { month: '2025-10', notaMedia: 58, tempoUso: 6 },
      { month: '2025-11', notaMedia: 66, tempoUso: 8 },
      { month: '2025-12', notaMedia: 74, tempoUso: 10 },
      { month: '2026-01', notaMedia: 82, tempoUso: 12 },
      { month: '2026-02', notaMedia: 90, tempoUso: 14 },
    ];
    const result = calculateDropoutRisk(data);
    expect(result.trend).toBe('rising');
    expect(result.slope).toBeGreaterThan(0);
    expect(result.riskLevel).toBe('green');
    expect(result.projectedAverage).toBeGreaterThan(result.currentAverage);
  });

  it('mantém o score entre 0 e 100', () => {
    const data: StudentMonthlyRecord[] = [
      { month: '2025-09', notaMedia: 30, tempoUso: 0 },
      { month: '2025-10', notaMedia: 20, tempoUso: 0 },
      { month: '2025-11', notaMedia: 10, tempoUso: 0 },
    ];
    const result = calculateDropoutRisk(data);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    result.projection.forEach(p => {
      expect(p.notaMedia).toBeGreaterThanOrEqual(0);
      expect(p.notaMedia).toBeLessThanOrEqual(100);
    });
  });

  it('trata histórico vazio com segurança', () => {
    const result = calculateDropoutRisk([]);
    expect(result.trend).toBe('stable');
    expect(result.riskLevel).toBe('green');
    expect(result.projection).toHaveLength(0);
  });
});