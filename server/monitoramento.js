/**
 * Monitoramento de erros do worker (#65), no formato do Sentry.
 *
 * Cópia mínima de `packages/core/src/monitoramento.ts`: o worker é JS
 * puro e roda na Cloudflare, onde não há como importar o TypeScript do
 * núcleo. O teste `server/__tests__/monitoramento.test.mjs` compara as
 * duas limpezas de dado pessoal, para nunca divergirem.
 */

const PADROES_PII = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '[token]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]'],
  [/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/([?&](?:key|token|access_token|apikey|secret)=)[^&\s]+/gi, '$1[oculto]'],
];

export function limparPii(texto) {
  let t = String(texto ?? '');
  for (const [re, troca] of PADROES_PII) t = t.replace(re, troca);
  return t.slice(0, 8000);
}

export async function reportarErroServidor(env, erro, rota) {
  let dsn;
  try {
    dsn = env.SENTRY_DSN ? new URL(String(env.SENTRY_DSN).trim()) : null;
  } catch {
    dsn = null;
  }
  if (!dsn || !dsn.username) return;
  const projeto = dsn.pathname.replace(/^\/+/, '');
  const e = erro instanceof Error ? erro : new Error(String(erro));
  const id = crypto.randomUUID().replace(/-/g, '');
  const evento = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: env.VERCEL_ENV || env.AMBIENTE || 'production',
    tags: { plataforma: 'worker', rota: limparPii(rota).slice(0, 120) },
    exception: { values: [{ type: limparPii(e.name), value: limparPii(e.message) }] },
    extra: { pilha: limparPii(e.stack || '') },
  };
  const corpo = [
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(evento),
  ].join('\n');
  try {
    await fetch(`${dsn.protocol}//${dsn.host}/api/${projeto}/envelope/?sentry_key=${dsn.username}&sentry_version=7`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: corpo,
    });
  } catch {
    /* sem rede para o Sentry: o erro segue só no log da plataforma */
  }
}
