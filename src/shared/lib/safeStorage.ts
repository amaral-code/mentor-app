/**
 * localStorage à prova de modo privado/cota estourada.
 *
 * `getItem/setItem` jogam `SecurityError/QuotaExceededError` no modo
 * privado e com cota cheia — sem try/catch isso quebra a interação que
 * chamou (login, envio de mensagem, troca de aba). Estes helpers nunca
 * jogam: leitura falha devolve o fallback, escrita falha só loga.
 */

function temStorage(): boolean {
  // `typeof` não joga mesmo quando localStorage nem existe (SSR, testes
  // em node): sem isso o ReferenceError escapava do try/catch.
  return typeof localStorage !== 'undefined';
}

export function safeGet(chave: string, fallback: string | null = null): string | null {
  if (!temStorage()) return fallback;
  try {
    const v = localStorage.getItem(chave);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function safeSet(chave: string, valor: string): boolean {
  if (!temStorage()) return false;
  try {
    localStorage.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(chave: string): void {
  if (!temStorage()) return;
  try {
    localStorage.removeItem(chave);
  } catch {
    /* indisponível: nada a remover */
  }
}
