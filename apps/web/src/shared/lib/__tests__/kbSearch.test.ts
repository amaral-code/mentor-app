import { describe, it, expect } from 'vitest';
import { searchKB, matchSubject, extractKeywords, SPECIAL_RESPONSES, FAQS } from '../kbSearch';
import { QuizQuestion } from '../../types';

const mockQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    materia: 'Matemática',
    enunciado: 'Qual é a fórmula da área do círculo?',
    alternativas: ['πr²', '2πr', 'πd', 'r²'],
    correta: 0,
    explicacao: 'A área do círculo é π vezes o raio ao quadrado.',
  },
];

describe('searchKB', () => {
  it('returns null for empty input', () => {
    expect(searchKB('', FAQS)).toBeNull();
  });

  it('finds matching FAQ entry', () => {
    const result = searchKB('como funciona o enem?', FAQS);
    expect(result).not.toBeNull();
    expect(result!.entry.id).toBe('faq_1');
  });

  it('finds redacao entry for keywords', () => {
    const result = searchKB('como fazer a redacao do enem?', FAQS);
    expect(result).not.toBeNull();
    expect(result!.entry.id).toBe('faq_3');
  });

  it('returns null when no match found', () => {
    const result = searchKB('xyzzy completamente aleatório', FAQS);
    expect(result).toBeNull();
  });

  it('returns higher score for better match', () => {
    const result = searchKB('como funciona a nota do enem e a tri?', FAQS);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(2);
  });
});

describe('matchSubject', () => {
  it('detects Matemática', () => {
    expect(matchSubject('preciso de ajuda com matemática')).toBe('Matemática');
  });

  it('detects Português', () => {
    expect(matchSubject('tenho dúvida de gramática')).toBe('Português');
  });

  it('detects História', () => {
    expect(matchSubject('revolução francesa foi importante')).toBe('História');
  });

  it('returns null for unrecognized subject', () => {
    expect(matchSubject('vou viajar no fim de semana')).toBeNull();
  });
});

describe('extractKeywords', () => {
  it('extracts meaningful keywords from text', () => {
    const keywords = extractKeywords('como funciona a nota do enem?');
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.every(k => k.length > 3)).toBe(true);
  });

  it('returns limited keywords', () => {
    const keywords = extractKeywords('matemática geometria calculo equação física química biologia');
    expect(keywords.length).toBeLessThanOrEqual(5);
  });
});

describe('SPECIAL_RESPONSES', () => {
  it('has greeting responses', () => {
    expect(SPECIAL_RESPONSES['ola']).toBeDefined();
    expect(SPECIAL_RESPONSES['oi']).toBeDefined();
    expect(SPECIAL_RESPONSES['bom dia']).toBeDefined();
  });

  it('has thank you responses', () => {
    expect(SPECIAL_RESPONSES['obrigado']).toBeDefined();
  });

  it('has identity response', () => {
    expect(SPECIAL_RESPONSES['quem é você']).toContain('Mentor ENEM');
  });
});
