import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Mesmas garantias do SupabaseRepository, extraidas para os repositorios
 * do modulo de bem-estar.
 *
 * A divisao em varios repositorios (marketplace, bem-estar, foco,
 * conteudo) e proposital: SupabaseRepository ja tem 900 linhas e cobre o
 * app inteiro. Somar 7 funcionalidades ali transformaria o arquivo em um
 * indice. O que NAO pode divergir sao estes dois comportamentos - erro
 * de leitura vira lista vazia com aviso no console; erro de escrita
 * PROPAGA, porque quem chamou precisa desfazer a atualizacao otimista.
 */

/** Erro de LEITURA: registra e segue - a tela mostra o que conseguiu. */
export function falhou(op: string, error: unknown): void {
  if (error) console.warn(`[supabase] ${op} falhou:`, error);
}

/** Erro de ESCRITA: registra e propaga. O tipo `never` corta o fluxo. */
export function exigir(op: string, error: unknown): never {
  console.warn(`[supabase] ${op} falhou:`, error);
  const mensagem = (error as { message?: string })?.message;
  throw new Error(mensagem ? `${op}: ${mensagem}` : `${op} falhou`);
}

export function clienteAtivo(): boolean {
  return isSupabaseConfigured() && !!getSupabase();
}

export async function uidAtual(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

export { getSupabase };
