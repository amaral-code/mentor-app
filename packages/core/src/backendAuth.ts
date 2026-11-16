import { aiProxyToken, temBackendIA, urlBackendIA } from './runtimeConfig';

/**
 * Cabeçalhos de TODA chamada ao back-end do app (`/api/*`).
 *
 * Existe por causa de uma falha real: `/generate`, `/tts` e
 * `/api/chat/completions` não mandavam a sessão, e por isso o servidor
 * não tinha como exigir login. Qualquer pessoa na internet usava a cota
 * de IA de quem publicou o app. Agora o servidor recusa pedido sem
 * sessão, e este é o ponto único que a anexa: rota nova que use este
 * helper já nasce autenticada.
 *
 * O núcleo não conhece o Supabase. Quem sabe ler a sessão é o
 * `@mentor/api`, que registra o leitor aqui ao ser carregado
 * (`registrarLeitorDeSessao`). Sem leitor, ou com a leitura falhando, o
 * cabeçalho só não vai, e o servidor responde 401 com mensagem que a
 * tela entende.
 */
type LeitorDeSessao = () => Promise<string | null>;

const CHAVE = '__mentorLeitorDeSessao';
type Global = typeof globalThis & { [CHAVE]?: LeitorDeSessao };

/* Em `globalThis`, como a plataforma: sobrevive a `vi.resetModules()` e
   a duas cópias do módulo no mesmo bundle. */
export function registrarLeitorDeSessao(leitor: LeitorDeSessao): void {
  (globalThis as Global)[CHAVE] = leitor;
}

export async function cabecalhosBackend(json = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';

  const token = aiProxyToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const jwt = await (globalThis as Global)[CHAVE]?.();
    if (jwt) headers['X-Supabase-Auth'] = jwt;
  } catch {
    /* sem sessão o servidor devolve 401 acionável */
  }
  return headers;
}

/**
 * Pede ao servidor que envie os avisos pendentes AGORA.
 *
 * A fila só era esvaziada por um cron, e na Vercel não havia cron: o
 * alerta ao responsável ficava na tabela para sempre. Quem acaba de
 * gerar um aviso chama isto, e ele sai em segundos em vez de esperar o
 * próximo disparo agendado.
 *
 * Nunca rejeita e não espera resposta útil: é um empurrão, não uma etapa
 * do fluxo de quem chamou.
 */
export async function acionarFilaDeAvisos(): Promise<void> {
  if (!temBackendIA()) return;
  try {
    await fetch(urlBackendIA('/notify/drain'), {
      method: 'POST',
      headers: await cabecalhosBackend(),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* o cron diário cobre o que este empurrão não entregar */
  }
}
