import { normalizarPreferencias, type PreferenciasNotificacao } from '@mentor/core/notificacoes';
import { getSupabase } from './supabase';

/**
 * Inscrições de push e preferências (migration 032).
 *
 * Gravar inscrição e preferências passa por função do banco: a inscrição
 * precisa poder MUDAR de dono (outra conta no mesmo navegador) e as
 * preferências são filtradas lá, sem confiar no jsonb do cliente.
 */
export class NotificacoesRepository {
  async carregarPreferencias(): Promise<PreferenciasNotificacao> {
    const sb = getSupabase();
    if (!sb) return normalizarPreferencias(null);
    const { data } = await sb.from('preferencias_notificacao').select('tipos, silencio_inicio, silencio_fim, limite_diario').maybeSingle();
    return normalizarPreferencias(data);
  }

  async salvarPreferencias(p: PreferenciasNotificacao): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.rpc('salvar_preferencias_notificacao', {
      p_tipos: p.tipos,
      p_silencio_inicio: p.silencioInicio,
      p_silencio_fim: p.silencioFim,
      p_limite_diario: p.limiteDiario,
    });
    return !error;
  }

  async salvarInscricao(i: { endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.rpc('salvar_inscricao_push', {
      p_endpoint: i.endpoint,
      p_p256dh: i.p256dh,
      p_auth: i.auth,
      p_user_agent: i.userAgent ?? null,
    });
    return !error;
  }

  async removerInscricao(endpoint: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('push_inscricoes').delete().eq('endpoint', endpoint);
  }
}

export const notificacoesRepository = new NotificacoesRepository();
