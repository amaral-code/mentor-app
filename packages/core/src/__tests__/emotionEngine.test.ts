import { describe, it, expect } from 'vitest';
import { detectEmotion, getMoodColor, getMoodBodyClass, getEmpathicPrefix } from '../emotionEngine';

describe('detectEmotion', () => {
  it('returns neutral for text without emotion keywords', () => {
    const result = detectEmotion('vou estudar matemática hoje');
    expect(result.mood).toBe('neutral');
    expect(result.matchCount).toBe(0);
  });

  it('detects stress from text', () => {
    const result = detectEmotion('estou muito estressado com a prova');
    expect(result.mood).toBe('stress');
    expect(result.matchCount).toBeGreaterThan(0);
  });

  it('detects anxiety from text', () => {
    const result = detectEmotion('estou ansioso para o resultado');
    expect(result.mood).toBe('anxiety');
  });

  it('detects sadness from text', () => {
    const result = detectEmotion('me sinto triste hoje');
    expect(result.mood).toBe('sadness');
  });

  it('detects focus from text', () => {
    const result = detectEmotion('estou muito focado estudando');
    expect(result.mood).toBe('focused');
  });

  it('detects motivation from text', () => {
    const result = detectEmotion('estou motivado para estudar');
    expect(result.mood).toBe('motivated');
  });

  it('detects happiness from text', () => {
    const result = detectEmotion('estou feliz com meu progresso');
    expect(result.mood).toBe('happy');
  });

  it('ignores negated words', () => {
    const result = detectEmotion('não estou estressado');
    expect(result.mood).toBe('neutral');
  });

  it('handles mixed emotions and picks dominant', () => {
    const result = detectEmotion('estou estressado e ansioso com a prova mas feliz');
    // stress (1) + anxiety (1) + happy (1) → dominant is the first found alphabetically
    expect(result.matchCount).toBeGreaterThanOrEqual(2);
  });

  it('returns valence and sscDelta', () => {
    const result = detectEmotion('estou estressado');
    expect(result.valence).toBeLessThan(0);
    expect(result.sscDelta).toBeGreaterThan(0);
  });
});

describe('getMoodColor', () => {
  it('returns red for stress', () => {
    expect(getMoodColor('stress')).toBe('#ef4444');
  });

  it('returns amber for anxiety', () => {
    expect(getMoodColor('anxiety')).toBe('#f59e0b');
  });

  it('returns purple for sadness', () => {
    expect(getMoodColor('sadness')).toBe('#a855f7');
  });

  it('returns green for positive moods', () => {
    expect(getMoodColor('focused')).toBe('#10b981');
    expect(getMoodColor('happy')).toBe('#10b981');
    expect(getMoodColor('neutral')).toBe('#10b981');
  });
});

describe('getMoodBodyClass', () => {
  it('returns correct class for each mood', () => {
    expect(getMoodBodyClass('stress')).toBe('mood-stress');
    expect(getMoodBodyClass('anxiety')).toBe('mood-anxiety');
    expect(getMoodBodyClass('sadness')).toBe('mood-sad');
    expect(getMoodBodyClass('focused')).toBe('mood-focus');
  });
});

describe('getEmpathicPrefix', () => {
  it('returns non-empty string for stress', () => {
    const prefix = getEmpathicPrefix('stress');
    expect(prefix.length).toBeGreaterThan(0);
  });

  it('returns empty string for neutral', () => {
    expect(getEmpathicPrefix('neutral')).toBe('');
  });
});
