import { describe, expect, it } from 'vitest';
import { alvosDeRevisao, notaDoQuiz, questoesDoBancoLocal, xpDoQuiz } from '../sessaoQuiz';
import { hashEnunciado } from '../quizHistory';
import { QUIZ_BANK } from '../quizBank';

describe('xp e nota', () => {
  it('30 XP por acerto e nota de 0 a 100', () => {
    expect(xpDoQuiz(7)).toBe(210);
    expect(xpDoQuiz(-1)).toBe(0);
    expect(notaDoQuiz(7, 10)).toBe(70);
    expect(notaDoQuiz(3, 0)).toBe(0);
    expect(notaDoQuiz(12, 10)).toBe(100);
  });
});

describe('alvosDeRevisao', () => {
  it('cada tópico escolhido vira um item; Geral vira a matéria', () => {
    expect(alvosDeRevisao('Física', ['Óptica', 'Geral'])).toEqual([{ topicoId: 'física:óptica', topicoNome: 'Óptica', materia: 'Física' }]);
    expect(alvosDeRevisao('Física', ['Geral'])).toEqual([{ topicoId: 'física:física', topicoNome: 'Física', materia: 'Física' }]);
  });
  it('quiz aberto por uma revisão reagenda o MESMO tópico', () => {
    const revisao = { topicoId: 'abc', topicoNome: 'Funções', materia: 'Matemática' };
    expect(alvosDeRevisao('Matemática', ['Trigonometria'], revisao)).toEqual([revisao]);
  });
});

describe('questoesDoBancoLocal', () => {
  it('só da matéria pedida e sem as já vistas', () => {
    const daMat = QUIZ_BANK.filter((q) => q.materia === 'Matemática');
    const vistas = new Set([hashEnunciado(daMat[0].enunciado)]);
    const r = questoesDoBancoLocal('Matemática', 50, vistas, () => 0.5);
    expect(r.every((q) => q.materia === 'Matemática')).toBe(true);
    expect(r.some((q) => q.id === daMat[0].id)).toBe(false);
    expect(r.length).toBe(daMat.length - 1);
  });
  it('todas vistas: repete em vez de deixar sem quiz', () => {
    const daMat = QUIZ_BANK.filter((q) => q.materia === 'Matemática');
    const vistas = new Set(daMat.map((q) => hashEnunciado(q.enunciado)));
    expect(questoesDoBancoLocal('Matemática', 2, vistas)).toHaveLength(Math.min(2, daMat.length));
  });
});
