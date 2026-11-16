// =========================================================
// MOTOR DE PREDIÇÃO DE EVASÃO - Regressão Linear em JS puro
// Recebe o histórico mensal do estudante (notas + tempo de
// uso do app) e projeta os próximos 4 meses via reta de
// mínimos quadrados.
// =========================================================

export interface StudentMonthlyRecord {
  month: string; // "YYYY-MM"
  notaMedia: number; // 0-100: desempenho escolar medio do mes
  tempoUso: number; // horas totais de uso do app no mes
}

export interface LinearFit {
  slope: number; // inclinação (pts/mês)
  intercept: number;
  r2: number; // coeficiente de determinação (0-1)
}

export type RiskLevel = 'green' | 'yellow' | 'red';
export type TrendDirection = 'falling' | 'rising' | 'stable';

export interface DropoutProjection {
  slope: number;
  r2: number;
  trend: TrendDirection; // direção matemática da linha de tendência
  riskLevel: RiskLevel; // status atual do aluno
  riskScore: number; // 0-100
  currentAverage: number; // média das notas no histórico
  projectedAverage: number; // média nas projeções de 4 meses
  projection: { month: string; notaMedia: number }[]; // próximos 4 meses
}

export const PROJECTION_MONTHS = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(m)) return month;
  const total = year * 12 + (m - 1) + delta;
  const y = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${y}-${String(mm).padStart(2, '0')}`;
}

/**
 * Regressão Linear simples (mínimos quadrados) sobre pares (x, y).
 * Crucially, x é sempre o índice do mês (0..n-1), y a variável observada.
 */
export function linearRegression(data: { x: number; y: number }[]): LinearFit {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: data[0].y, r2: 1 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of data) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = denom === 0 ? sumY / n : (sumY - slope * sumX) / n;

  // Coeficiente de determinação R² (qualidade do ajuste)
  const meanY = sumY / n;
  const ssTot = data.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
  const ssRes = data.reduce((acc, p) => acc + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Calcula a projeção cognitiva de evasão para os próximos 4 meses.
 *
 * 1) Regressão linear sobre as notas do histórico reta de tendência.
 * 2) Projeta os próximos 4 meses sobre essa reta (t = n..n+3).
 * 3) Converte inclinação + nível atual + engajamento em um score 0-100
 * e deriva o status de risco (verde/amarelo/vermelho).
 */
export function calculateDropoutRisk(historicalData: StudentMonthlyRecord[]): DropoutProjection {
  if (historicalData.length === 0) {
    return {
      slope: 0,
      r2: 0,
      trend: 'stable',
      riskLevel: 'green',
      riskScore: 0,
      currentAverage: 0,
      projectedAverage: 0,
      projection: [],
    };
  }

  const points = historicalData.map((d, i) => ({ x: i, y: d.notaMedia }));
  const fit = linearRegression(points);
  const currentAverage = points.reduce((acc, p) => acc + p.y, 0) / points.length;

  const lastIndex = points.length - 1;
  const lastMonth = historicalData[historicalData.length - 1].month;
  const projection = Array.from({ length: PROJECTION_MONTHS }, (_, k) => {
    const idx = lastIndex + 1 + k;
    return {
      month: addMonths(lastMonth, k + 1),
      notaMedia: round2(clamp(fit.intercept + fit.slope * idx, 0, 100)),
    };
  });
  const projectedAverage = projection.reduce((acc, p) => acc + p.notaMedia, 0) / projection.length;

  // Tendência derivada diretamente da inclinação da reta
  const trend: TrendDirection = fit.slope <= -0.7 ? 'falling' : fit.slope >= 0.7 ? 'rising' : 'stable';

  // Componentes do score de risco
  const performancePenalty =
    currentAverage >= 75 ? 0 : currentAverage >= 60 ? 15 : currentAverage >= 45 ? 35 : 60;

  const slopePenalty = fit.slope < 0 ? clamp(Math.abs(fit.slope) * 12, 0, 50) : -clamp(fit.slope * 10, 0, 20);

  // Engajamento: queda rápida no tempo de uso reforça o sinal de risco
  const engagementPoints = historicalData.map((d, i) => ({ x: i, y: d.tempoUso }));
  const engagement = linearRegression(engagementPoints);
  const engagementPenalty = engagement.slope < -0.9 ? 8 : engagement.slope < -0.3 ? 4 : 0;

  // Confiança estatística do ajuste
  const fitBonus = fit.r2 > 0.5 ? (fit.slope < 0 ? 4 : -3) : 0;

  const rawScore = performancePenalty + slopePenalty + engagementPenalty + fitBonus;
  const riskScore = round2(clamp(rawScore, 0, 100));
  const riskLevel: RiskLevel = riskScore >= 60 ? 'red' : riskScore >= 32 ? 'yellow' : 'green';

  return {
    slope: round2(fit.slope),
    r2: round2(clamp(fit.r2, 0, 1)),
    trend,
    riskLevel,
    riskScore,
    currentAverage: round2(currentAverage),
    projectedAverage: round2(projectedAverage),
    projection,
  };
}
