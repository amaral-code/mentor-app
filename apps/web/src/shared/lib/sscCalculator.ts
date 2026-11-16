import { MoodType, SSCInput, SSCLevel } from '../types';

/**
 * Cálculo heurístico do Índice de Sobrecarga (SSC - Stress Score Cansado).
 * 0-100%. Totalmente local, baseado em regras.
 * Substituir por modelo ML se precisar de maior precisão.
 */
const MOOD_SSC_DELTA: Record<MoodType, number> = {
  stress: 10,
  anxiety: 8,
  sadness: 5,
  tired: 6,
  demotivated: 4,
  focused: -5,
  motivated: -6,
  happy: -8,
  energetic: -7,
  neutral: 0,
};

export function calculateSSC(input: SSCInput): number {
  const { sono, cansaco, mood } = input;

  let base = 20;

  // Penalidade por sono insuficiente
  if (sono < 6) {
    base += (6 - sono) * 12;
  } else if (sono > 9) {
    base -= 5;
  }

  // Penalidade por cansaço alto
  if (cansaco > 5) {
    base += (cansaco - 5) * 6;
  }

  // Delta do humor
  base += MOOD_SSC_DELTA[mood] || 0;

  return Math.max(0, Math.min(100, base));
}

export function getSSCLevel(ssc: number): SSCLevel {
  if (ssc < 40) return 'normal';
  if (ssc < 70) return 'attention';
  return 'critical';
}

export function getSSCColor(ssc: number): string {
  if (ssc < 40) return '#10b981';
  if (ssc < 70) return '#f59e0b';
  return '#ef4444';
}

export function getSSCLabel(ssc: number): string {
  if (ssc < 40) return 'Normal';
  if (ssc < 70) return 'Atenção';
  return 'Risco Crítico';
}
