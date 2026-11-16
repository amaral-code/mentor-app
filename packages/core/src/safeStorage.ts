/**
 * Armazenamento local à prova de modo privado/cota estourada.
 *
 * `getItem/setItem` jogam `SecurityError/QuotaExceededError` no modo
 * privado e com cota cheia — sem try/catch isso quebra a interação que
 * chamou (login, envio de mensagem, troca de aba). Estes helpers nunca
 * jogam: leitura falha devolve o fallback, escrita falha só loga.
 *
 * O armazenamento vem da plataforma (localStorage no web, MMKV no
 * celular), nunca de `localStorage` direto: no React Native ele não existe.
 */
import { plataforma, type ArmazenamentoChaveValor } from './plataforma';

function armazenamento(): ArmazenamentoChaveValor | null {
  try {
    return plataforma().armazenamento();
  } catch {
    return null;
  }
}

export function safeGet(chave: string, fallback: string | null = null): string | null {
  const a = armazenamento();
  if (!a) return fallback;
  try {
    const v = a.getItem(chave);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function safeSet(chave: string, valor: string): boolean {
  const a = armazenamento();
  if (!a) return false;
  try {
    a.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(chave: string): void {
  const a = armazenamento();
  if (!a) return;
  try {
    a.removeItem(chave);
  } catch {
    /* indisponível: nada a remover */
  }
}
