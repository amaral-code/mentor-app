import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../appStore';
import { userRepository } from '../../shared/storage/UserRepository';

/**
 * Botao Sair (rodape da sidebar, ao lado do XP).
 *
 * Travam o sintoma "cliquei e nada aconteceu": apos logout(), a sessao
 * precisa estar nula, isAuthenticated falso e as listas do aluno anterior
 * limpas — mesmo se o signOut de rede falhar.
 */

beforeEach(() => {
  useAppStore.setState({
    session: {
      uid: 'u1', nome: 'Aluno', email: 'a@a.com', role: 'student',
      deveTrocarSenha: false,
    } as never,
    isAuthenticated: true,
    userRole: 'student',
    chatMessages: [{ id: 'm1', role: 'user', text: 'oi', timestamp: 1 } as never],
    conversaAtivaId: 'c1',
    toastMessage: 'pendente',
  });
  vi.restoreAllMocks();
});

describe('logout', () => {
  it('derruba a sessao e limpa os dados mesmo com rede falhando', async () => {
    vi.spyOn(userRepository, 'logout').mockRejectedValue(new Error('offline'));

    useAppStore.getState().logout();
    await Promise.resolve();

    const s = useAppStore.getState();
    expect(s.session).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.chatMessages).toEqual([]);
    expect(s.conversaAtivaId).toBeNull();
    expect(s.toastMessage).toBeNull();
    expect(s.activeTab).toBe('dashboard');
  });

  it('avisa o servidor quando ha rede, sem bloquear a saida', async () => {
    const signOut = vi.spyOn(userRepository, 'logout').mockResolvedValue(undefined);

    useAppStore.getState().logout();

    expect(useAppStore.getState().isAuthenticated).toBe(false);
    await Promise.resolve();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
