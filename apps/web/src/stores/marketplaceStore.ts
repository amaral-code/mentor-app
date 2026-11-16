import { create } from 'zustand';
import type {
  Agendamento,
  AlertaSaudeMental,
  JanelaDisponibilidade,
  Notificacao,
  Psicologo,
  SlotAgenda,
  VinculoResponsavel,
} from '../shared/types';
import { marketplaceRepository } from '../shared/storage/MarketplaceRepository';
import { useAppStore } from './appStore';

/**
 * Estado do marketplace (catalogo, agenda, consultas, alertas, vinculos).
 *
 * O fluxo completo de compra vive aqui porque ele atravessa quatro
 * passos que precisam saber uns dos outros: escolher profissional ->
 * escolher horario -> criar o agendamento pendente -> pagar. Espalhar
 * isso por componentes faria cada um refazer requisicao e, pior, faria a
 * tela achar que pagou quando so criou.
 */

interface MarketplaceState {
  psicologos: Psicologo[];
  disponibilidade: Record<string, JanelaDisponibilidade[]>;
  slots: Record<string, SlotAgenda[]>;
  agendamentos: Agendamento[];
  alertas: AlertaSaudeMental[];
  vinculos: VinculoResponsavel[];
  notificacoes: Notificacao[];
  carregando: boolean;
  processandoPagamento: boolean;

  carregarCatalogo: () => Promise<void>;
  carregarAgenda: (psicologoId: string) => Promise<void>;
  carregarConsultas: () => Promise<void>;
  carregarAlertas: (alunoId?: string) => Promise<void>;
  carregarVinculos: () => Promise<void>;
  carregarNotificacoes: () => Promise<void>;

  /** Cria o agendamento pendente e abre o checkout. Devolve a consulta. */
  contratar: (
    psicologo: Psicologo,
    alunoId: string,
    slot: SlotAgenda,
    alertaId?: string | null,
  ) => Promise<Agendamento | null>;

  cancelar: (id: string) => Promise<void>;
  marcarAlertaVisto: (id: string) => Promise<void>;
  solicitarVinculo: (email: string, parentesco: string) => Promise<boolean>;
  responderVinculo: (id: string, aceitar: boolean) => Promise<void>;
  marcarNotificacaoLida: (id: string) => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  psicologos: [],
  disponibilidade: {},
  slots: {},
  agendamentos: [],
  alertas: [],
  vinculos: [],
  notificacoes: [],
  carregando: false,
  processandoPagamento: false,

  carregarCatalogo: async () => {
    set({ carregando: true });
    const psicologos = await marketplaceRepository.listarPsicologos();
    set({ psicologos, carregando: false });
  },

  carregarAgenda: async (psicologoId) => {
    // Janelas e slots vem juntos: a tela mostra "atende seg a sex, 14h-20h"
    // e, logo abaixo, os horarios de fato livres.
    const [janelas, slots] = await Promise.all([
      marketplaceRepository.carregarDisponibilidade(psicologoId),
      marketplaceRepository.slotsLivres(psicologoId),
    ]);
    set((s) => ({
      disponibilidade: { ...s.disponibilidade, [psicologoId]: janelas },
      slots: { ...s.slots, [psicologoId]: slots },
    }));
  },

  carregarConsultas: async () => {
    const agendamentos = await marketplaceRepository.listarAgendamentos();

    // O nome do profissional vem do catalogo (a tabela de agendamentos
    // guarda so o id, e o perfil dele nao e legivel pelo aluno).
    let catalogo = get().psicologos;
    if (catalogo.length === 0 && agendamentos.length > 0) {
      catalogo = await marketplaceRepository.listarPsicologos();
      set({ psicologos: catalogo });
    }
    const nomePorId = new Map(catalogo.map((p) => [p.id, p.nome]));

    set({
      agendamentos: agendamentos.map((a) => ({
        ...a,
        psicologoNome: a.psicologoNome ?? nomePorId.get(a.psicologoId),
      })),
    });
  },

  carregarAlertas: async (alunoId) => {
    const alertas = await marketplaceRepository.listarAlertas(alunoId);
    set({ alertas });
  },

  carregarVinculos: async () => {
    const vinculos = await marketplaceRepository.listarVinculos();
    set({ vinculos });
  },

  carregarNotificacoes: async () => {
    const notificacoes = await marketplaceRepository.listarNotificacoes();
    set({ notificacoes });
  },

  /**
   * Agendar e pagar.
   *
   * A consulta nasce com status_pagamento 'pendente' e SEM link de sala.
   * Quem marca 'pago' e cria a sala e o webhook do provedor, chamando
   * confirmar_pagamento_consulta com service_role. Por isso, no fim,
   * recarregamos a consulta do banco em vez de assumir sucesso: no modo
   * simulado ela ja volta confirmada, no modo real volta pendente ate o
   * provedor avisar.
   */
  contratar: async (psicologo, alunoId, slot, alertaId) => {
    const app = useAppStore.getState();
    set({ processandoPagamento: true });

    try {
      const agendamento = await marketplaceRepository.agendar(
        psicologo.id,
        alunoId,
        slot.inicio,
        alertaId ?? null,
      );

      const checkout = await marketplaceRepository.iniciarPagamento(
        agendamento,
        app.session?.email ?? '',
      );

      if (checkout.checkoutUrl) {
        // Sai do app: o provedor cuida do cartao/PIX e o webhook confirma.
        window.location.assign(checkout.checkoutUrl);
        return agendamento;
      }

      const atualizado = (await marketplaceRepository.buscarAgendamento(agendamento.id)) ?? agendamento;
      set((s) => ({ agendamentos: [...s.agendamentos, atualizado] }));

      app.setToast(
        atualizado.statusPagamento === 'pago'
          ? 'Consulta confirmada. O link da sala esta na sua lista de consultas.'
          : 'Consulta reservada. Assim que o pagamento cair, o link da sala aparece aqui.',
        'success',
      );
      return atualizado;
    } catch (e: any) {
      app.setToast(e?.message || 'Nao foi possivel concluir o agendamento.', 'error');
      return null;
    } finally {
      set({ processandoPagamento: false });
    }
  },

  cancelar: async (id) => {
    const anterior = get().agendamentos;
    set({ agendamentos: anterior.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a)) });
    try {
      await marketplaceRepository.cancelar(id);
      useAppStore.getState().setToast('Consulta cancelada.', 'info');
    } catch {
      set({ agendamentos: anterior });
      useAppStore.getState().setToast('Nao foi possivel cancelar. Tente de novo.', 'error');
    }
  },

  marcarAlertaVisto: async (id) => {
    set((s) => ({ alertas: s.alertas.map((a) => (a.id === id ? { ...a, status: 'visto' } : a)) }));
    try {
      await marketplaceRepository.marcarAlerta(id, 'visto');
    } catch {
      // Silencio proposital: e so a marca de leitura. Na proxima carga
      // o alerta volta como aberto, sem perda de informacao.
    }
  },

  solicitarVinculo: async (email, parentesco) => {
    try {
      const vinculo = await marketplaceRepository.solicitarVinculo(email, parentesco);
      set((s) => ({ vinculos: [vinculo, ...s.vinculos] }));
      useAppStore
        .getState()
        .setToast('Pedido enviado. O estudante precisa aprovar no app dele.', 'success');
      return true;
    } catch (e: any) {
      useAppStore.getState().setToast(e?.message || 'Nao foi possivel enviar o pedido.', 'error');
      return false;
    }
  },

  responderVinculo: async (id, aceitar) => {
    const anterior = get().vinculos;
    set({
      vinculos: anterior.map((v) => (v.id === id ? { ...v, status: aceitar ? 'ativo' : 'recusado' } : v)),
    });
    try {
      await marketplaceRepository.responderVinculo(id, aceitar);
    } catch {
      set({ vinculos: anterior });
      useAppStore.getState().setToast('Nao foi possivel responder ao pedido.', 'error');
    }
  },

  marcarNotificacaoLida: async (id) => {
    set((s) => ({ notificacoes: s.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)) }));
    try {
      await marketplaceRepository.marcarNotificacaoLida(id);
    } catch {
      // Idem: marca de leitura, sem consequencia visivel se falhar.
    }
  },
}));
