import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './runtimeConfig';

/*
 * URL e chave vem de `runtimeConfig` (Environment Variables lidas em
 * tempo de execucao via /api/config), NUNCA de constantes de modulo.
 *
 * Antes este arquivo lia `import.meta.env` no topo. Como o Vite congela
 * esse valor no build, uma implantacao cujas variaveis foram preenchidas
 * depois do primeiro deploy subia com strings vazias gravadas no bundle -
 * e o app simplesmente ignorava o Supabase, sem erro visivel.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;

  const url = supabaseUrl();
  const chave = supabaseAnonKey();
  /* Sem credencial nao cacheia nada: a config pode chegar depois do boot
     e a proxima chamada deve conseguir criar o cliente. */
  if (!url || !chave) return null;

  client = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl() && supabaseAnonKey());
}
