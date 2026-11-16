import Storage from 'expo-sqlite/kv-store';
import type { ArmazenamentoChaveValor } from '@mentor/core/plataforma';

/**
 * Armazenamento síncrono do celular: o kv-store do expo-sqlite (síncrono
 * como o localStorage que o core espera, e roda até no Expo Go).
 *
 * O web tem o próprio arquivo (`armazenamentoLocal.web.ts`): o Metro
 * escolhe pelo sufixo, e assim o SQLite em WebAssembly nem entra no
 * bundle do navegador.
 */
export function criarArmazenamento(): (ArmazenamentoChaveValor & { getAllKeys(): string[] }) | null {
  return {
    getItem: (k) => Storage.getItemSync(k),
    setItem: (k, v) => Storage.setItemSync(k, v),
    removeItem: (k) => void Storage.removeItemSync(k),
    // Para o "sair" apagar o que é desta conta (ver sessao/sair.ts).
    getAllKeys: () => Storage.getAllKeysSync(),
  };
}
