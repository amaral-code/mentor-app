/**
 * Implementação web dos adaptadores do @mentor/core.
 *
 * Importado como PRIMEIRO import de main.tsx (e no setup dos testes): os
 * módulos do core leem a plataforma só dentro de funções, então basta que
 * ela esteja instalada antes da primeira chamada.
 *
 * Cada campo lê o valor na hora da chamada, e não na importação. Assim
 * `vi.stubEnv` e `vi.stubGlobal('localStorage', ...)` continuam valendo
 * nos testes, do mesmo jeito que valiam antes da extração para o pacote.
 */
import { configurarPlataforma } from '@mentor/core/plataforma';

configurarPlataforma({
  armazenamento: () =>
    // `typeof` não joga mesmo quando localStorage nem existe (testes em Node).
    typeof localStorage !== 'undefined' ? localStorage : null,
  envBuild: (nome) => {
    const valor = (import.meta.env as Record<string, unknown>)[nome];
    return typeof valor === 'string' ? valor.trim() : '';
  },
  online: () => (typeof navigator !== 'undefined' ? navigator.onLine : null),
  dev: () => import.meta.env.DEV === true,
  abrirUrl: (url) => window.location.assign(url),
  aoIrParaSegundoPlano: (aoSair) => {
    if (typeof document === 'undefined') return () => {};
    // visibilitychange, e nao unload: e o unico confiavel no iOS.
    const ouvir = () => {
      if (document.visibilityState === 'hidden') aoSair();
    };
    document.addEventListener('visibilitychange', ouvir);
    return () => document.removeEventListener('visibilitychange', ouvir);
  },
});
