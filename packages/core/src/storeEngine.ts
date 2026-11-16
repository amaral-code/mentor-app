// =========================================================
// MOTOR DA LOJA - lógica pura de compra/equipe (sem estado).
// Testável em node puro; o storeStore (zustand) é apenas a
// camada de persistência + integração com o XP.
// =========================================================

import { SHOP_ITEMS } from './storeCatalog';

export interface InventoryEntry {
  purchased: boolean;
  equipped: boolean;
}

export type Inventory = Record<string, InventoryEntry>;

export interface PurchaseResult {
  inventory: Inventory;
  cost: number;
}

export function canPurchase(inventory: Inventory, itemId: string, xp: number): boolean {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return false;
  if (inventory[itemId]?.purchased) return false;
  return xp >= item.price;
}

/** Deduz o custo do inventário e devolve no máximo o saldo disponível. */
export function applyPurchase(inventory: Inventory, itemId: string, xp: number): PurchaseResult | null {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return null;
  if (inventory[itemId]?.purchased) return null;
  const cost = Math.min(item.price, Math.max(0, xp));
  if (cost < item.price) return null; // saldo insuficiente

  return {
    inventory: {
      ...inventory,
      [itemId]: { purchased: true, equipped: false },
    },
    cost,
  };
}

/** Equipa um único item adquirido, desativando os demais. */
export function applyEquip(inventory: Inventory, itemId: string): Inventory {
  if (!inventory[itemId]?.purchased) return inventory;
  const next: Inventory = {};
  for (const [id, entry] of Object.entries(inventory)) {
    next[id] = entry.purchased ? { ...entry, equipped: id === itemId } : entry;
  }
  return next;
}

export function equippedItemId(inventory: Inventory): string | null {
  const id = Object.entries(inventory).find(([, entry]) => entry.purchased && entry.equipped)?.[0];
  return id ?? null;
}