import { create } from 'zustand';
import { useAppStore } from './appStore';
import { SHOP_ITEMS } from '../shared/lib/storeCatalog';
import { applyEquip, Inventory } from '../shared/lib/storeEngine';
import { supabaseRepository } from '../shared/storage/SupabaseRepository';

/**
 * Inventario da Loja do Sagui.
 *
 * A compra acontece NO SERVIDOR (RPC comprar_item). Antes, o desconto de
 * XP era feito aqui no cliente e persistido em localStorage - ou seja, o
 * aluno podia se dar os itens de graca pelo console. Agora este store so
 * reflete o resultado que o banco devolveu.
 */

export interface StoreState {
  inventory: Inventory;
  carregando: boolean;
  /** Carrega o inventario do banco (chamado no login). */
  carregar: () => Promise<void>;
  /** Compra no servidor. Devolve true no sucesso. */
  buyItem: (itemId: string) => Promise<boolean>;
  /** Equipa um item (desativa os demais). */
  equipItem: (itemId: string) => Promise<void>;
  limpar: () => void;
}

export const useStoreStore = create<StoreState>((set, get) => ({
  inventory: {},
  carregando: false,

  carregar: async () => {
    set({ carregando: true });
    const inv = await supabaseRepository.loadInventario();
    set({ inventory: inv, carregando: false });
  },

  buyItem: async (itemId) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    if (get().inventory[itemId]?.purchased) return false;

    const { setToast, updateGamification } = useAppStore.getState();

    const { gamificacao, erro } = await supabaseRepository.comprarItem(itemId);
    if (erro || !gamificacao) {
      setToast(erro ?? 'Nao foi possivel comprar.', 'error');
      return false;
    }

    // Saldo autoritativo do servidor, nao um calculo local.
    updateGamification(gamificacao);
    set((s) => ({
      inventory: { ...s.inventory, [itemId]: { purchased: true, equipped: false } },
    }));
    setToast(`${item.name} adquirido!`, 'success');
    return true;
  },

  equipItem: async (itemId) => {
    const atual = get().inventory;
    if (!atual[itemId]?.purchased) return;

    const proximo = applyEquip(atual, itemId);
    set({ inventory: proximo }); // otimista: a troca precisa ser instantanea
    const ok = await supabaseRepository.equiparItem(itemId);
    if (!ok) set({ inventory: atual }); // desfaz se o servidor recusar
  },

  limpar: () => set({ inventory: {} }),
}));
