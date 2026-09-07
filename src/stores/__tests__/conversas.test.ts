import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../appStore';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';

/**
 * Threads do Mentor (migration 016).
 *
 * O risco aqui e misturar mensagens entre conversas: salvar na thread
 * errada ou exibir o historico de outra. Estes testes travam o vinculo
 * (conversaAtivaId -> save/load), a troca com guarda de corrida e o
 * titulo automatico da primeira mensagem.
 */

function resetStore() {
  useAppStore.setState({
    conversas: [],
    conversaAtivaId: null,
    chatMessages: [],
    toastMessage: null,
  });
}

beforeEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

describe('novaConversa', () => {
  it('usa o id definitivo do banco quando online', async () => {
    vi.spyOn(supabaseRepository, 'createConversa').mockResolvedValue({
      id: 'uuid-1', titulo: 'Nova conversa', modo: 'enem_geral', criadoEm: 1,
    });

    await useAppStore.getState().novaConversa();

    const s = useAppStore.getState();
    expect(s.conversaAtivaId).toBe('uuid-1');
    expect(s.conversas[0].id).toBe('uuid-1');
    expect(s.chatMessages).toEqual([]);
  });

  it('offline cria thread so-local sem quebrar', async () => {
    vi.spyOn(supabaseRepository, 'createConversa').mockResolvedValue(null);

    await useAppStore.getState().novaConversa();

    expect(useAppStore.getState().conversaAtivaId).toMatch(/^tmp_/);
  });
});

describe('selecionarConversa', () => {
  it('carrega so as mensagens da thread ativa (guarda de corrida)', async () => {
    useAppStore.setState({
      conversas: [
        { id: 'a', titulo: 'A', modo: 'enem_geral', criadoEm: 1 },
        { id: 'b', titulo: 'B', modo: 'enem_geral', criadoEm: 2 },
      ],
    });
    const load = vi.spyOn(supabaseRepository, 'loadChat');
    // A segunda chamada resolve primeiro: so a ultima escolha vale.
    load.mockImplementation(async (_limite, id) => {
      await new Promise((r) => setTimeout(r, id === 'a' ? 20 : 0));
      return [{ id: `m-${id}`, role: 'user', text: `msg ${id}`, timestamp: 1 }];
    });

    const p1 = useAppStore.getState().selecionarConversa('a');
    const p2 = useAppStore.getState().selecionarConversa('b');
    await Promise.all([p1, p2]);

    const s = useAppStore.getState();
    expect(s.conversaAtivaId).toBe('b');
    expect(s.chatMessages.map((m) => m.id)).toEqual(['m-b']);
  });
});

describe('apagarConversa', () => {
  it('remove, avisa e abre a proxima thread', async () => {
    useAppStore.setState({
      conversas: [
        { id: 'a', titulo: 'A', modo: 'enem_geral', criadoEm: 1 },
        { id: 'b', titulo: 'B', modo: 'enem_geral', criadoEm: 2 },
      ],
      conversaAtivaId: 'a',
    });
    vi.spyOn(supabaseRepository, 'deleteConversa').mockResolvedValue(undefined);
    vi.spyOn(supabaseRepository, 'loadChat').mockResolvedValue([]);

    await useAppStore.getState().apagarConversa('a');

    const s = useAppStore.getState();
    expect(s.conversas.map((c) => c.id)).toEqual(['b']);
    expect(s.conversaAtivaId).toBe('b');
  });

  it('falha no banco nao remove da tela', async () => {
    useAppStore.setState({
      conversas: [{ id: 'a', titulo: 'A', modo: 'enem_geral', criadoEm: 1 }],
      conversaAtivaId: 'a',
    });
    vi.spyOn(supabaseRepository, 'deleteConversa').mockRejectedValue(new Error('x'));

    await useAppStore.getState().apagarConversa('a');

    expect(useAppStore.getState().conversas).toHaveLength(1);
  });
});

describe('addChatMessage na thread', () => {
  it('salva amarrado a conversa ativa', async () => {
    useAppStore.setState({
      conversas: [{ id: 'c1', titulo: 'Nova conversa', modo: 'enem_geral', criadoEm: 1 }],
      conversaAtivaId: 'c1',
    });
    const save = vi.spyOn(supabaseRepository, 'saveChatMessage').mockResolvedValue(undefined);
    vi.spyOn(supabaseRepository, 'renameConversa').mockResolvedValue(undefined);

    useAppStore.getState().addChatMessage({ id: 'm1', role: 'user', text: 'Oi, me ajuda?', timestamp: 1 });

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), 'c1');
  });

  it('primeira mensagem do aluno batiza a thread', async () => {
    useAppStore.setState({
      conversas: [{ id: 'c1', titulo: 'Nova conversa', modo: 'enem_geral', criadoEm: 1 }],
      conversaAtivaId: 'c1',
      chatMessages: [{ id: 'g', role: 'assistant', text: 'Olá!', timestamp: 0 }],
    });
    vi.spyOn(supabaseRepository, 'saveChatMessage').mockResolvedValue(undefined);
    const rename = vi.spyOn(supabaseRepository, 'renameConversa').mockResolvedValue(undefined);

    useAppStore.getState().addChatMessage({ id: 'm1', role: 'user', text: 'Dicas de TRI por favor', timestamp: 1 });

    expect(useAppStore.getState().conversas[0].titulo).toBe('Dicas de TRI por favor');
    expect(rename).toHaveBeenCalledWith('c1', 'Dicas de TRI por favor');
  });
});
