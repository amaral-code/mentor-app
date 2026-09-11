import { clienteAtivo, exigir, falhou, getSupabase, uidAtual } from './supabaseHelpers';
import type { FocusSessionMetrics } from '../../features/foco/focusLogic';

export interface FocusMetricRow extends FocusSessionMetrics {
  id: string;
  criadoEm: string;
}

/**
 * MODO FOCO CONSCIENTE — persistência das métricas de atenção.
 *
 * `salvarMetricasSessao` é a mutação de encerramento: chamada quando a
 * sessão de estudos termina, grava `focused_minutes` + `distraction_count`
 * em `focus_metrics` (migration 019). Erro de escrita PROPAGA (padrão dos
 * repositórios) para o chamador decidir — via `persistir()` com rollback.
 */
export class FocusMetricsRepository {
  /**
   * Salva as métricas ao encerrar a sessão de estudos.
   * Sem Supabase configurado ou sem usuário: silencioso (offline-first).
   */
  async salvarMetricasSessao(metrics: FocusSessionMetrics): Promise<FocusMetricRow | null> {
    if (!clienteAtivo()) return null;
    const sb = getSupabase()!;
    const uid = await uidAtual();
    if (!uid) return null;

    const { data, error } = await sb
      .from('focus_metrics')
      .insert({
        user_id: uid,
        session_date: metrics.sessionDate,
        focused_minutes: metrics.focusedMinutes,
        distraction_count: metrics.distractionCount,
      })
      .select('id, session_date, focused_minutes, distraction_count, criado_em')
      .single();

    if (error) exigir('salvarMetricasSessao', error);
    return {
      id: data.id,
      sessionDate: data.session_date,
      focusedMinutes: data.focused_minutes,
      distractionCount: data.distraction_count,
      criadoEm: data.criado_em,
    };
  }

  /** Últimas métricas (próprio aluno ou filho vinculado via `alunoId`). */
  async listarMetricas(limite = 30, alunoId?: string): Promise<FocusMetricRow[]> {
    if (!clienteAtivo()) return [];
    const sb = getSupabase()!;
    let consulta = sb
      .from('focus_metrics')
      .select('id, session_date, focused_minutes, distraction_count, criado_em, user_id')
      .order('criado_em', { ascending: false })
      .limit(limite);
    if (alunoId) consulta = consulta.eq('user_id', alunoId);

    const { data, error } = await consulta;
    if (error) {
      falhou('listarMetricas', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      sessionDate: r.session_date,
      focusedMinutes: r.focused_minutes,
      distractionCount: r.distraction_count,
      criadoEm: r.criado_em,
    }));
  }
}

export const focusMetricsRepository = new FocusMetricsRepository();
