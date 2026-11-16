import { cabecalhosBackend } from '@mentor/core/backendAuth';
import type { Feedback } from '@mentor/core/privacidade';
import { PALAVRA_EXCLUSAO } from '@mentor/core/privacidade';
import { urlBackendIA } from '@mentor/core/runtimeConfig';
import { getSupabase } from './supabase';

/**
 * Exportar e excluir a conta (LGPD, #70) e feedback do beta (#74).
 *
 * Exportar é uma RPC (`exportar_meus_dados`, migration 037): o banco sabe
 * quais tabelas são da pessoa. Excluir passa pelo back-end, porque apagar
 * o usuário do Auth exige a chave de servidor.
 */
export class PrivacidadeRepository {
  async exportarMeusDados(): Promise<unknown> {
    const sb = getSupabase();
    if (!sb) throw new Error('Sem conexão com o banco: não há dados guardados fora deste aparelho.');
    const { data, error } = await sb.rpc('exportar_meus_dados');
    if (error) throw new Error(error.message);
    return data;
  }

  async excluirConta(): Promise<void> {
    const resposta = await fetch(urlBackendIA('/api/conta/excluir'), {
      method: 'POST',
      headers: await cabecalhosBackend(),
      body: JSON.stringify({ confirmacao: PALAVRA_EXCLUSAO }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resposta.ok) {
      let mensagem = 'Não deu para excluir agora. Tente de novo em alguns minutos.';
      try {
        const corpo = (await resposta.json()) as { message?: string };
        if (corpo?.message) mensagem = corpo.message;
      } catch {
        /* resposta sem JSON: fica a mensagem padrão */
      }
      throw new Error(mensagem);
    }
    // A sessão aponta para um usuário que não existe mais.
    await getSupabase()?.auth.signOut().catch(() => undefined);
  }

  async enviarFeedback(f: Feedback, versao: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('Sem conexão com o banco agora. Tente mais tarde.');
    const { error } = await sb.rpc('enviar_feedback', {
      p_tipo: f.tipo,
      p_texto: f.texto.trim(),
      p_nota: f.nota ?? undefined,
      p_tela: f.tela,
      p_versao: versao,
    });
    if (error) throw new Error(/limite/.test(error.message) ? 'Você já mandou bastante hoje. Obrigado! Tente amanhã.' : error.message);
  }
}

export const privacidadeRepository = new PrivacidadeRepository();
