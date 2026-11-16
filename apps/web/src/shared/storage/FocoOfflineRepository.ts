import { clienteAtivo, exigir, falhou, getSupabase } from './supabaseHelpers';
import type { CarteiraFoco, ModoEscudo, SessaoOffline } from '../types';

/**
 * ESCUDO DE DOPAMINA - sessoes offline e carteira de moedas.
 *
 * Nenhum metodo aqui escreve saldo. O cliente manda INICIO e FIM da
 * sessao; creditar_moedas_foco() recalcula os minutos pelo relogio do
 * servidor, aplica faixa, penalidade e teto diario, e devolve o saldo
 * novo. Se o valor viesse do navegador, "ficar offline" seria a forma
 * mais facil de gerar moeda infinita do app inteiro.
 */
export class FocoOfflineRepository {
  async carregarCarteira(): Promise<CarteiraFoco> {
    if (!clienteAtivo()) return { saldo: 0, totalGanho: 0, totalGasto: 0 };
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('carteira_foco')
      .select('saldo, total_ganho, total_gasto')
      .maybeSingle();

    if (error) {
      falhou('carregarCarteira', error);
      return { saldo: 0, totalGanho: 0, totalGasto: 0 };
    }
    return {
      saldo: data?.saldo ?? 0,
      totalGanho: data?.total_ganho ?? 0,
      totalGasto: data?.total_gasto ?? 0,
    };
  }

  async listarSessoes(limite = 60, alunoId?: string): Promise<SessaoOffline[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    let consulta = sb
      .from('sessoes_offline')
      .select('id, inicio, fim, minutos_offline, interrupcoes, modo, moedas_creditadas, user_id')
      .order('inicio', { ascending: false })
      .limit(limite);
    if (alunoId) consulta = consulta.eq('user_id', alunoId);

    const { data, error } = await consulta;
    if (error) {
      falhou('listarSessoes', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      inicio: r.inicio,
      fim: r.fim,
      minutosOffline: r.minutos_offline,
      interrupcoes: r.interrupcoes,
      modo: r.modo as ModoEscudo,
      moedasCreditadas: r.moedas_creditadas,
    }));
  }

  /**
   * Fecha a sessao e credita.
   *
   * Devolve o que o SERVIDOR calculou - a tela deve substituir a previa
   * otimista por estes numeros, nunca soma-los.
   */
  async creditarSessao(
    inicio: Date,
    fim: Date,
    interrupcoes: number,
    modo: ModoEscudo,
  ): Promise<{ saldo: number; moedas: number; minutos: number }> {
    if (!clienteAtivo()) return { saldo: 0, moedas: 0, minutos: 0 };
    const sb = getSupabase()!;

    const { data, error } = await sb.rpc('creditar_moedas_foco', {
      p_inicio: inicio.toISOString(),
      p_fim: fim.toISOString(),
      p_interrupcoes: interrupcoes,
      p_modo: modo,
    });

    if (error) exigir('creditar_moedas_foco', error);
    const row: any = Array.isArray(data) ? data[0] : data;
    return {
      saldo: row?.saldo ?? 0,
      moedas: row?.moedas_creditadas ?? 0,
      minutos: row?.minutos ?? 0,
    };
  }

  async gastar(quantidade: number, motivo: string): Promise<number> {
    if (!clienteAtivo()) throw new Error('Supabase nao configurado');
    const sb = getSupabase()!;
    const { data, error } = await sb.rpc('gastar_moedas_foco', {
      p_quantidade: quantidade,
      p_motivo: motivo,
    });
    if (error) exigir('gastar_moedas_foco', error);
    return typeof data === 'number' ? data : 0;
  }

  async extrato(limite = 20): Promise<{ delta: number; motivo: string; data: string }[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('extrato_foco')
      .select('delta, motivo, criado_em')
      .order('criado_em', { ascending: false })
      .limit(limite);

    if (error) {
      falhou('extrato', error);
      return [];
    }
    return (data ?? []).map((r) => ({ delta: r.delta, motivo: r.motivo, data: r.criado_em }));
  }
}

export const focoOfflineRepository = new FocoOfflineRepository();
