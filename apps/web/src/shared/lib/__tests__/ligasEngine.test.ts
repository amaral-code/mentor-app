import { describe, it, expect } from 'vitest';
import { joinLeague, postLeagueMessage, createStudyLeague, toggleGoalCompletion } from '../ligasEngine';

describe('ligasEngine', () => {
  it('inscreve o aluno na liga sem torná-la obrigatória', () => {
    const league = createStudyLeague({
      id: 'liga_1',
      title: 'Desafio de Português',
      prompt: 'Explique a regra da crase em uma frase curta.',
      authorName: 'Prof. Lígia',
      turma: '3A',
      escola: 'Escola do Sol',
      xpReward: 40,
      discipline: 'Português',
      goals: [{ id: 'g1', title: 'Resolver 3 exercícios', description: 'Exercícios de crase', target: 3, unit: 'exercícios' }],
    });

    const updated = joinLeague(league, 'student_1', 'Ana');

    expect(updated.acceptedBy).toContain('student_1');
    expect(updated.joinedBy).toContain('student_1');
    expect(updated.acceptedByNames).toContain('Ana');
    expect(updated.status).toBe('accepted');
    expect(updated.xpReward).toBe(40);
  });

  it('marca e desmarca metas de atividade por disciplina', () => {
    const league = createStudyLeague({
      id: 'liga_2',
      title: 'Ligue matemáticos',
      prompt: 'Resolva a equação 2x + 4 = 12.',
      authorName: 'Prof. João',
      turma: '3B',
      escola: 'Escola do Sol',
      xpReward: 25,
      discipline: 'Matemática',
      goals: [{ id: 'g1', title: 'Resolver 6 exercícios', description: 'Exercícios exatos', target: 6, unit: 'exercícios' }],
    });

    const completed = toggleGoalCompletion(league, 'g1', 'student_2');
    expect(completed.goals[0].completedBy).toContain('student_2');

    const reverted = toggleGoalCompletion(completed, 'g1', 'student_2');
    expect(reverted.goals[0].completedBy).not.toContain('student_2');
  });
});
