import { afterEach, describe, expect, it, vi } from 'vitest';
import { focoOfflineRepository } from '@mentor/api/FocoOfflineRepository';
import { useBemEstarStore } from '../bemEstarStore';

afterEach(() => {
  vi.restoreAllMocks();
  useBemEstarStore.getState().cancelarEscudo();
});

const espera = () => new Promise((r) => setTimeout(r, 0));

/*
 * Desde a 031 o servidor carimba início e fim da sessão de foco. A store
 * precisa usar esse caminho sempre que o servidor abriu a sessão, e só
 * cair no antigo (aparelho diz início e fim) com o banco sem a 031.
 */
describe('escudo com sessão no servidor (031)', () => {
  it('abre no servidor e fecha mandando só minutos e interrupções medidos', async () => {
    vi.spyOn(focoOfflineRepository, 'iniciarSessao').mockResolvedValue({ id: 'sessao-1', iniciadaEm: '' });
    const encerrar = vi.spyOn(focoOfflineRepository, 'encerrarSessao').mockResolvedValue({ saldo: 40, moedas: 37, minutos: 30 });
    const antigo = vi.spyOn(focoOfflineRepository, 'creditarSessao');

    useBemEstarStore.getState().iniciarEscudo('enem');
    await espera();
    expect(useBemEstarStore.getState().escudo.sessaoId).toBe('sessao-1');

    useBemEstarStore.setState((s) => ({ escudo: { ...s.escudo, inicio: Date.now() - 31 * 60_000 } }));
    const r = await useBemEstarStore.getState().encerrarEscudo({ minutosOffline: 30, interrupcoes: 1 });

    expect(encerrar).toHaveBeenCalledWith('sessao-1', 30, 1);
    expect(antigo).not.toHaveBeenCalled();
    expect(r).toEqual({ moedas: 37, minutos: 30 });
    expect(useBemEstarStore.getState().carteira.saldo).toBe(40);
  });

  it('banco sem a 031 (sem id): cai no caminho antigo', async () => {
    vi.spyOn(focoOfflineRepository, 'iniciarSessao').mockResolvedValue(null);
    const antigo = vi.spyOn(focoOfflineRepository, 'creditarSessao').mockResolvedValue({ saldo: 10, moedas: 10, minutos: 20 });

    useBemEstarStore.getState().iniciarEscudo('leve');
    await espera();
    useBemEstarStore.setState((s) => ({ escudo: { ...s.escudo, inicio: Date.now() - 20 * 60_000 } }));
    await useBemEstarStore.getState().encerrarEscudo();

    expect(antigo).toHaveBeenCalledTimes(1);
  });

  it('a resposta atrasada de uma sessão cancelada não amarra o id na próxima', async () => {
    let responder: (v: { id: string; iniciadaEm: string }) => void = () => {};
    vi.spyOn(focoOfflineRepository, 'iniciarSessao').mockReturnValue(new Promise((r) => (responder = r)));

    useBemEstarStore.getState().iniciarEscudo('enem');
    useBemEstarStore.getState().cancelarEscudo();
    responder({ id: 'velha', iniciadaEm: '' });
    await espera();
    expect(useBemEstarStore.getState().escudo.sessaoId ?? null).toBeNull();
  });
});
