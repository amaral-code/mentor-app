// =========================================================
// CATÁLOGO DA LOJA - itens para personalizar o Sagui
// Usado pela StudentStore (compra) e pelo FocusCompanion
// (exibição dos acessórios equipados junto ao mascote).
// =========================================================

export interface StoreItem {
  id: string;
  name: string;
  price: number; // custo em XP
  /** Nome do icone no registro de AppIcon. */
  icon: string;
  desc: string;
  benefit: string;
  gradient: string; // tailwind gradient do card
}

export const SHOP_ITEMS: StoreItem[] = [
  {
    id: 'moletom',
    name: 'Moletom Midnight',
    price: 500,
    icon: 'moletom',
    desc: 'Vista o Sagui com o agasalho mais estiloso da noite.',
    benefit: '+10% visual de mestre dos estudos',
    gradient: 'from-violet-500/20 to-purple-600/10',
  },
  {
    id: 'oculos',
    name: 'Óculos de Cientista',
    price: 300,
    icon: 'oculos',
    desc: 'Inteligência de sobra para encarar qualquer questão.',
    benefit: 'Combina com lógica e raciocínio',
    gradient: 'from-cyan-500/20 to-blue-600/10',
  },
  {
    id: 'fones',
    name: 'Fones de Foco',
    price: 400,
    icon: 'fone',
    desc: 'Isolamento total para mergulhar nos estudos.',
    benefit: 'Parceiro perfeito para o modo foco',
    gradient: 'from-emerald-500/20 to-cyan-600/10',
  },
];

export function getStoreItem(id: string): StoreItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}
