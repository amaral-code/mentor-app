import { describe, it, expect } from 'vitest';
import { calculateSSC, getSSCLevel, getSSCColor, getSSCLabel } from '../sscCalculator';
import { MoodType, SSCInput } from '../../types';

describe('calculateSSC', () => {
  it('returns base 20 for normal inputs with neutral mood', () => {
    const input: SSCInput = { sono: 7, cansaco: 3, mood: 'neutral' };
    expect(calculateSSC(input)).toBe(20);
  });

  it('increases score when sleep < 6h', () => {
    const input: SSCInput = { sono: 4, cansaco: 3, mood: 'neutral' };
    // base 20 + (6-4)*12 = 20 + 24 = 44
    expect(calculateSSC(input)).toBe(44);
  });

  it('decreases score when sleep > 9h', () => {
    const input: SSCInput = { sono: 10, cansaco: 3, mood: 'neutral' };
    // base 20 - 5 = 15
    expect(calculateSSC(input)).toBe(15);
  });

  it('increases score when fatigue > 5', () => {
    const input: SSCInput = { sono: 7, cansaco: 8, mood: 'neutral' };
    // base 20 + (8-5)*6 = 20 + 18 = 38
    expect(calculateSSC(input)).toBe(38);
  });

  it('adds mood delta for stress', () => {
    const input: SSCInput = { sono: 7, cansaco: 3, mood: 'stress' };
    // base 20 + 10 (stress delta) = 30
    expect(calculateSSC(input)).toBe(30);
  });

  it('clamps at 0 minimum', () => {
    const input: SSCInput = { sono: 10, cansaco: 0, mood: 'happy' };
    // base 20 - 5 (sono>9) - 8 (happy delta) = 7
    const result = calculateSSC(input);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('clamps at 100 maximum', () => {
    const input: SSCInput = { sono: 0, cansaco: 10, mood: 'stress' };
    const result = calculateSSC(input);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('combines multiple penalties', () => {
    const input: SSCInput = { sono: 4, cansaco: 8, mood: 'anxiety' };
    // base 20 + (6-4)*12 + (8-5)*6 + 8 = 20 + 24 + 18 + 8 = 70
    expect(calculateSSC(input)).toBe(70);
  });
});

describe('getSSCLevel', () => {
  it('returns normal for score < 40', () => {
    expect(getSSCLevel(20)).toBe('normal');
  });

  it('returns attention for score 40-69', () => {
    expect(getSSCLevel(40)).toBe('attention');
    expect(getSSCLevel(55)).toBe('attention');
    expect(getSSCLevel(69)).toBe('attention');
  });

  it('returns critical for score >= 70', () => {
    expect(getSSCLevel(70)).toBe('critical');
    expect(getSSCLevel(100)).toBe('critical');
  });
});

describe('getSSCColor', () => {
  it('returns green for normal', () => {
    expect(getSSCColor(20)).toBe('#10b981');
  });

  it('returns amber for attention', () => {
    expect(getSSCColor(55)).toBe('#f59e0b');
  });

  it('returns red for critical', () => {
    expect(getSSCColor(85)).toBe('#ef4444');
  });
});

describe('getSSCLabel', () => {
  it('returns correct labels', () => {
    expect(getSSCLabel(20)).toBe('Normal');
    expect(getSSCLabel(55)).toBe('Atenção');
    expect(getSSCLabel(85)).toBe('Risco Crítico');
  });
});
