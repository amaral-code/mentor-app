import type { OperacaoOffline, ResultadoEnvio } from '@mentor/core/filaOffline';
import { plataforma } from '@mentor/core/plataforma';
import { getSupabase } from './supabase';

/**
 * Executor da fila offline (#56): envia UMA operação para
 * `aplicar_operacao` (migration 033), que aplica cada chave uma vez só.
 *
 * O que importa aqui é separar "tente de novo" de "desista":
 *   • sem cliente, sem sessão ou sem rede: tente de novo depois;
 *   • erro do próprio banco (SQLSTATE, recusa da função): desista, porque
 *     repetir o mesmo dado traz a mesma recusa.
 */
export function classificarErro(erro: { code?: string; message?: string } | null): ResultadoEnvio {
  if (!erro) return { status: 'aplicada' };
  const mensagem = String(erro.message ?? '');
  if (/fetch|network|timeout|nao autenticado|jwt/i.test(mensagem)) return { status: 'rede' };
  // SQLSTATE tem 5 caracteres (P0001, 22P02, 23514...); PGRST* é do PostgREST.
  if (erro.code && (/^[0-9A-Z]{5}$/.test(erro.code) || erro.code.startsWith('PGRST'))) {
    return { status: 'recusada', motivo: mensagem || erro.code };
  }
  return { status: 'rede' };
}

export async function aplicarOperacao(op: OperacaoOffline): Promise<ResultadoEnvio> {
  const sb = getSupabase();
  if (!sb || plataforma().online() === false) return { status: 'rede' };
  const { data, error } = await sb.rpc('aplicar_operacao', {
    p_chave: op.chave,
    p_tipo: op.tipo,
    p_dados: op.dados as never,
    p_feita_em: op.feitaEm,
  });
  const r = classificarErro(error);
  return r.status === 'aplicada' ? { status: 'aplicada', resposta: data } : r;
}
