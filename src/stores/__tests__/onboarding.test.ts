import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../appStore';

/**
 * Onboarding inteligente: concluir o wizard vira patch funcional sobre a
 * sessao atual — primeiro acesso vira recorrente sem zerar o resto.
 */

const SESSAO_BASE = {
  uid: 'u1',
  nome: 'Aluno',
  email: 'a@a.com',
  role: 'student',
  deveTrocarSenha: false,
  onboardingCompleted: false,
  metasEstudo: [],
  tempoDiarioEstudo: null,
  turnoEstudo: null,
} as never;

beforeEach(() => {
  useAppStore.setState({ session: SESSAO_BASE, isAuthenticated: true });
  vi.restoreAllMocks();
});

describe('concluirOnboardingLocal', () => {
  it('marca primeiro-acesso como concluido mantendo o resto da sessao', () => {
    useAppStore.getState().concluirOnboardingLocal({
      metas: ['Passar no ENEM'],
      tempoDiario: '1 hora',
      turno: 'noite',
    });

    const s = useAppStore.getState().session!;
    expect(s.onboardingCompleted).toBe(true);
    expect(s.metasEstudo).toEqual(['Passar no ENEM']);
    expect(s.tempoDiarioEstudo).toBe('1 hora');
    expect(s.turnoEstudo).toBe('noite');
    // Nada mais mexeu: uid, papel e autenticacao intactos.
    expect(s.uid).toBe('u1');
    expect(useAppStore.getState().isAuthenticated).toBe(true);
  });

  it('sem sessao, nao faz nada (sem crash)', () => {
    useAppStore.setState({ session: null });
    expect(() =>
      useAppStore.getState().concluirOnboardingLocal({ metas: [], tempoDiario: '15 min', turno: 'manha' }),
    ).not.toThrow();
    expect(useAppStore.getState().session).toBeNull();
  });
});
