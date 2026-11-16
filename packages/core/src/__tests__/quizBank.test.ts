import { describe, it, expect } from 'vitest';
import { QUIZ_BANK, getQuestionsByMateria, getRandomQuestions, getMaterias } from '../quizBank';

describe('QUIZ_BANK', () => {
  it('has at least 30 questions', () => {
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(30);
  });

  it('every question has 4 alternatives', () => {
    QUIZ_BANK.forEach(q => {
      expect(q.alternativas.length).toBe(4);
    });
  });

  it('every question has valid correct answer index', () => {
    QUIZ_BANK.forEach(q => {
      expect(q.correta).toBeGreaterThanOrEqual(0);
      expect(q.correta).toBeLessThan(4);
    });
  });

  it('every question has explanation', () => {
    QUIZ_BANK.forEach(q => {
      expect(q.explicacao.length).toBeGreaterThan(0);
    });
  });
});

describe('getQuestionsByMateria', () => {
  it('returns questions for existing materia', () => {
    const questions = getQuestionsByMateria('Matemática');
    expect(questions.length).toBeGreaterThan(0);
    questions.forEach(q => {
      expect(q.materia).toBe('Matemática');
    });
  });

  it('returns empty array for non-existent materia', () => {
    const questions = getQuestionsByMateria('NãoExiste');
    expect(questions.length).toBe(0);
  });
});

describe('getRandomQuestions', () => {
  it('returns requested number of questions', () => {
    const questions = getRandomQuestions('Matemática', 3);
    expect(questions.length).toBe(3);
  });

  it('does not exceed available questions', () => {
    const all = getQuestionsByMateria('Inglês');
    const questions = getRandomQuestions('Inglês', 99);
    expect(questions.length).toBeLessThanOrEqual(all.length);
  });
});

describe('getMaterias', () => {
  it('returns all unique materias', () => {
    const materias = getMaterias();
    expect(materias).toContain('Matemática');
    expect(materias).toContain('Português');
    expect(materias).toContain('História');
    expect(materias).toContain('Redação');
    expect(materias.length).toBeGreaterThanOrEqual(10);
  });
});
