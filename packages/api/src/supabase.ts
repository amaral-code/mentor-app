import { createClient, SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@mentor/core/runtimeConfig';
import { registrarLeitorDeSessao } from '@mentor/core/backendAuth';

/*
 * URL e chave vem de `runtimeConfig` (Environment Variables lidas em
 * tempo de execucao via /api/config), NUNCA de constantes de modulo.
 *
 * Antes este arquivo lia `import.meta.env` no topo. Como o Vite congela
 * esse valor no build, uma implantacao cujas variaveis foram preenchidas
 * depois do primeiro deploy subia com strings vazias gravadas no bundle -
 * e o app simplesmente ignorava o Supabase, sem erro visivel.
 */

/**
 * O que muda no cliente entre plataformas.
 *
 * No web nada precisa ser passado: o supabase-js guarda a sessao no
 * localStorage e le o token do link magico na URL. No celular nao ha
 * nenhum dos dois: o app passa um storage (expo-secure-store/AsyncStorage)
 * e desliga a leitura da URL, tratando o link magico pelo deep link.
 */
export interface OpcoesClienteSupabase {
  /** Onde guardar a sessao. Omitido: localStorage (padrao do supabase-js). */
  storage?: SupportedStorage;
  /** Ler o token da URL apos o link magico. Padrao: true (web). */
  detectSessionInUrl?: boolean;
}

let client: SupabaseClient | null = null;
let opcoes: OpcoesClienteSupabase = {};

/**
 * Chamar no boot, antes do primeiro `getSupabase()`. Descarta um cliente
 * ja criado para que as novas opcoes valham.
 */
export function configurarSupabase(novas: OpcoesClienteSupabase): void {
  opcoes = { ...novas };
  client = null;
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client;

  const url = supabaseUrl();
  const chave = supabaseAnonKey();
  /* Sem credencial nao cacheia nada: a config pode chegar depois do boot
     e a proxima chamada deve conseguir criar o cliente. */
  if (!url || !chave) return null;

  client = createClient(url, chave, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(opcoes.storage ? { storage: opcoes.storage } : {}),
      ...(opcoes.detectSessionInUrl === undefined ? {} : { detectSessionInUrl: opcoes.detectSessionInUrl }),
    },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl() && supabaseAnonKey());
}

/* O núcleo monta os cabeçalhos do back-end, mas só este pacote sabe ler
   a sessão. Registrar ao carregar o módulo garante que toda chamada de
   IA saia autenticada assim que existir cliente. */
registrarLeitorDeSessao(async () => {
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
});
