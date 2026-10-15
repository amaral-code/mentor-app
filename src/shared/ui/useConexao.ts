import { useSyncExternalStore } from 'react';

/*
 * Estado real da conexão do aparelho.
 *
 * Substitui o selo "Online" que o cabeçalho mostrava SEMPRE, com uma
 * bolinha verde pulsando: ele dizia "online" no modo avião também. Agora
 * o cabeçalho fica quieto quando há rede e avisa quando cai, que é o
 * único momento em que a informação muda o que o aluno vai fazer (a IA
 * não responde e o que ele salvar fica para depois).
 */
function assinar(avisar: () => void) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

export function useConexao(): boolean {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    // Sem navegador (teste/SSR): presume conectado para não acusar falha
    // que não existe.
    () => true,
  );
}
