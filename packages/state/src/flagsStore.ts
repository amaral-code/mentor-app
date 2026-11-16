import { create } from 'zustand';
import { getSupabase } from '@mentor/api/supabase';

/**
 * Feature flags (#69). O banco decide quem cai em cada flag
 * (`minhas_flags()`, migration 035); o app só carrega a lista ao abrir.
 *
 * Uso numa tela:
 *   const ligada = useFlagsStore((s) => s.ligadas.includes('quiz_5_alternativas'));
 *
 * Sem rede, a lista fica vazia: toda flag desligada é o comportamento
 * seguro (a versão de sempre).
 */
interface EstadoFlags {
  ligadas: string[];
  carregar: () => Promise<void>;
}

export const useFlagsStore = create<EstadoFlags>((set) => ({
  ligadas: [],
  carregar: async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb.rpc('minhas_flags');
    if (error) return;
    const lista = (Array.isArray(data) ? data : []).map((x) => (typeof x === 'string' ? x : String((x as { minhas_flags?: string }).minhas_flags ?? '')));
    set({ ligadas: lista.filter(Boolean) });
  },
}));

export const flagLigada = (chave: string): boolean => useFlagsStore.getState().ligadas.includes(chave);
