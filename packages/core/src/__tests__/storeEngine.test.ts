import { describe, it, expect } from 'vitest';
import { applyPurchase, applyEquip, canPurchase, equippedItemId, Inventory } from '../storeEngine';

const empty: Inventory = {};

describe('canPurchase', () => {
  it('permite comprar item não adquirido com saldo suficiente', () => {
    expect(canPurchase(empty, 'oculos', 300)).toBe(true);
    expect(canPurchase(empty, 'moletom', 500)).toBe(true);
  });

  it('recusa saldo insuficiente', () => {
    expect(canPurchase(empty, 'moletom', 499)).toBe(false);
    expect(canPurchase(empty, 'oculos', 299)).toBe(false);
  });

  it('recusa item já adquirido e item inexistente', () => {
    const inv: Inventory = { moletom: { purchased: true, equipped: false } };
    expect(canPurchase(inv, 'moletom', 9999)).toBe(false);
    expect(canPurchase(empty, 'inexistente', 9999)).toBe(false);
  });
});

describe('applyPurchase', () => {
  it('deduz o custo e marca o item como adquirido', () => {
    const result = applyPurchase(empty, 'moletom', 1200);
    expect(result).not.toBeNull();
    expect(result!.cost).toBe(500);
    expect(result!.inventory['moletom'].purchased).toBe(true);
    expect(result!.inventory['moletom'].equipped).toBe(false);
  });

  it('retorna null com saldo insuficiente', () => {
    expect(applyPurchase(empty, 'fones', 300)).toBeNull();
  });

  it('retorna null para item já adquirido', () => {
    const inv: Inventory = { fones: { purchased: true, equipped: false } };
    expect(applyPurchase(inv, 'fones', 9999)).toBeNull();
  });
});

describe('applyEquip', () => {
  it('equipa um item e desativa os demais', () => {
    const owned: Inventory = {
      moletom: { purchased: true, equipped: false },
      fones: { purchased: true, equipped: false },
    };
    const a = applyEquip(owned, 'moletom');
    expect(a['moletom'].equipped).toBe(true);
    expect(a['fones'].equipped).toBe(false);

    const b = applyEquip(a, 'fones');
    expect(b['fones'].equipped).toBe(true);
    expect(b['moletom'].equipped).toBe(false);
  });

  it('não altera inventário ao equipar item não comprado', () => {
    const owned: Inventory = { moletom: { purchased: true, equipped: false } };
    const result = applyEquip(owned, 'oculos');
    expect(result).toBe(owned);
  });
});

describe('equippedItemId', () => {
  it('retorna o item equipado ou null', () => {
    const inv: Inventory = {
      moletom: { purchased: true, equipped: true },
      fones: { purchased: true, equipped: false },
    };
    expect(equippedItemId(inv)).toBe('moletom');
    expect(equippedItemId(empty)).toBeNull();
  });
});