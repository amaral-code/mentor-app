import { describe, expect, it } from 'vitest';
import { destinoDaSessao, grupoDoPapel, podeAbrir } from '../rotasPorPapel';

const sessao = (role: string, extra = {}) => ({ role, onboardingCompleted: true, ...extra });

describe('rotas por papel', () => {
  it('cada papel tem o seu grupo e só ele', () => {
    expect(grupoDoPapel('student')).toBe('aluno');
    expect(grupoDoPapel('parent')).toBe('familia');
    expect(grupoDoPapel('teacher')).toBe('professor');
    expect(grupoDoPapel('educator')).toBe('secretaria');
    expect(grupoDoPapel('psychologist')).toBe('psicologo');
    expect(grupoDoPapel('admin')).toBeNull();
    expect(podeAbrir('parent', 'aluno')).toBe(false);
    expect(podeAbrir('teacher', 'secretaria')).toBe(false);
    expect(podeAbrir('student', 'aluno')).toBe(true);
  });

  it('a ordem das portas é a do web', () => {
    expect(destinoDaSessao(null)).toEqual({ tipo: 'entrar' });
    expect(destinoDaSessao(sessao('student', { deveTrocarSenha: true, onboardingCompleted: false }))).toEqual({ tipo: 'trocar-senha' });
    expect(destinoDaSessao(sessao('student', { onboardingCompleted: false }))).toEqual({ tipo: 'boas-vindas' });
    // Primeiro acesso é só do aluno (o bug do web em 2026-09-24).
    expect(destinoDaSessao(sessao('psychologist', { onboardingCompleted: false }))).toMatchObject({ tipo: 'grupo', rota: '/psicologo' });
    expect(destinoDaSessao(sessao('admin'))).toEqual({ tipo: 'sem-tela' });
  });

  it('papel desconhecido não ganha grupo nenhum', () => {
    expect(grupoDoPapel('hacker')).toBeNull();
    expect(destinoDaSessao(sessao('hacker'))).toEqual({ tipo: 'sem-tela' });
  });
});
