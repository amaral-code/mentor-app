import { useAppStore } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { useStoreStore } from '@mentor/state/storeStore';
import { limparCache } from '@mentor/api/rankingEngine';
import { plataforma } from '@mentor/core/plataforma';

/*
 * Chaves do aparelho que guardam dado de QUEM está logado. Ficar com elas
 * depois de sair vazaria para a próxima conta no mesmo celular (irmãos
 * dividindo aparelho é o caso comum): o roteiro gerado, os cartões, o
 * pomodoro e as comprovações do outro.
 */
const PREFIXOS_DO_USUARIO = ['mm_'];
const CHAVES_CONHECIDAS = [
  'mm_flashcards',
  'mm_comprovacoes',
  'mm_pomodoro_inicio',
  'mm_aba_mentor',
  'mm_modo_resposta',
  'mm_tour_visto',
  'mm_api_key',
];

/**
 * Sair de verdade (#32): encerra a sessão no Supabase (o cofre do
 * sistema é limpo pelo próprio cliente), zera as stores em memória, o
 * cache do ranking e o que o app guardou no aparelho para esta conta.
 */
export async function sairDaConta(encerrarSessao: () => Promise<void>): Promise<void> {
  try {
    await encerrarSessao();
  } finally {
    useAppStore.getState().logout();
    useStoreStore.getState().limpar();
    useBemEstarStore.setState({
      telemetria: [],
      bufferTelemetria: [],
      previsao: null,
      historicoBurnout: [],
      sessoesOffline: [],
      revisoes: [],
      relatorios: [],
      intervencao: null,
      carregado: false,
      carteira: { saldo: 0, totalGanho: 0, totalGasto: 0 },
    });
    limparCache();
    const arm = plataforma().armazenamento();
    if (arm) {
      for (const k of CHAVES_CONHECIDAS) arm.removeItem(k);
      // Roteiros de pílula têm o id no nome: apagados pelo prefixo quando o armazenamento lista chaves.
      const listavel = arm as { getAllKeys?: () => string[] };
      for (const k of listavel.getAllKeys?.() ?? []) {
        if (PREFIXOS_DO_USUARIO.some((p) => k.startsWith(p))) arm.removeItem(k);
      }
    }
  }
}
