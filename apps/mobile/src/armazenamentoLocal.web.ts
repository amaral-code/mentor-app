import type { ArmazenamentoChaveValor } from '@mentor/core/plataforma';

/** Web (Expo Web): o próprio localStorage, como no app Vite. */
export function criarArmazenamento(): ArmazenamentoChaveValor | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}
