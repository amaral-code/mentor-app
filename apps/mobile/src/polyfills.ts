/**
 * O que o Hermes (motor JavaScript do React Native) ainda não traz e o
 * `@mentor/core` usa.
 *
 * `AbortSignal.timeout` e `AbortSignal.any` são a base do teto de 30s das
 * chamadas de IA (`sinalComTimeout`). Sem eles, a primeira pergunta ao
 * Mentor joga TypeError antes mesmo de sair do aparelho. Instalado só
 * quando falta: onde existe (web, versões novas do Hermes), fica o nativo.
 */

type ComExtras = typeof AbortSignal & {
  timeout?: (ms: number) => AbortSignal;
  any?: (sinais: AbortSignal[]) => AbortSignal;
};

const Sinal = AbortSignal as ComExtras;

if (typeof Sinal.timeout !== 'function') {
  Sinal.timeout = (ms: number) => {
    const controle = new AbortController();
    setTimeout(() => controle.abort(new Error('TimeoutError')), ms);
    return controle.signal;
  };
}

if (typeof Sinal.any !== 'function') {
  Sinal.any = (sinais: AbortSignal[]) => {
    const controle = new AbortController();
    for (const s of sinais) {
      if (s.aborted) {
        controle.abort(s.reason);
        break;
      }
      s.addEventListener('abort', () => controle.abort(s.reason), { once: true });
    }
    return controle.signal;
  };
}

export {};
