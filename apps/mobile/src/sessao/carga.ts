import { useSyncExternalStore } from 'react';
import { carregarDadosDoUsuario } from '@mentor/state/carregarDados';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { comTimeout, TIMEOUT_BOOT_MS } from '@mentor/core/comTimeout';

export type EstadoCarga = 'ociosa' | 'carregando' | 'pronta' | 'falhou';

/*
 * Estado da carga dos dados do usuário, fora do React: começa no boot da
 * sessão e as telas só leem. Serve ao esqueleto da Central (que não pode
 * dizer "sem atividade" enquanto a atividade ainda está chegando) e ao
 * puxar para atualizar.
 */
let estado: EstadoCarga = 'ociosa';
let emVoo: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function mudar(novo: EstadoCarga) {
  estado = novo;
  ouvintes.forEach((o) => o());
}

/** Carrega (ou recarrega) os dados. Duas chamadas seguidas viram uma só. */
export function iniciarCarga(): Promise<void> {
  if (emVoo) return emVoo;
  mudar('carregando');
  emVoo = comTimeout(carregarDadosDoUsuario(), TIMEOUT_BOOT_MS, 'Carregar dados')
    .then(() => mudar('pronta'))
    .catch((erro) => {
      mudar('falhou');
      throw erro;
    })
    .finally(() => {
      emVoo = null;
    });
  return emVoo;
}

/** Puxar para atualizar: dados do usuário e o módulo de bem-estar. */
export async function recarregarTudo(): Promise<void> {
  await Promise.allSettled([iniciarCarga(), useBemEstarStore.getState().carregarTudo()]);
}

export function useEstadoCarga(): EstadoCarga {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
    () => estado,
  );
}
