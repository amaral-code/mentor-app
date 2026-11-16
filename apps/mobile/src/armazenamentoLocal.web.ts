import type { ArmazenamentoChaveValor } from '@mentor/core/plataforma';

/** Web (Expo Web): o próprio localStorage, como no app Vite. */
export function criarArmazenamento(): (ArmazenamentoChaveValor & { getAllKeys(): string[] }) | null {
  if (typeof localStorage === 'undefined') return null;
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
    getAllKeys: () => Object.keys(localStorage),
  };
}
